import OpenAI from "openai";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = process.env.CLAUDE_API_KEY
  ? new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY || "",
    })
  : null;
const CLAUDE_MODELS = [
  "claude-sonnet-4-5-20250929",
  "claude-sonnet-4-5",
  "claude-haiku-4-5-20251001",
  "claude-haiku-4-5",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-sonnet-20240620",
  "claude-3-sonnet-20240229",
  "claude-3-haiku-20240307",
];

type TranslateRequest = {
  lines: string[];
  targetLanguage?: string;
  movieTitle?: string;
  movieYear?: string;
  movieOverview?: string;
  modelPreference?: "auto" | "openai" | "claude";
};

const SYSTEM_PROMPT = `
You are an expert subtitle translator.
Translate naturally (not literal) while preserving story and tone into the target language.
If provided, use the movie context to keep tone and terminology consistent.
Input is an array of raw subtitle lines (SRT-style). Preserve structure exactly:
- Keep line count identical to input; one output line per input line, same order.
- If a line is an index, timecode, blank, or contains markup (e.g., <i>…</i>), return it unchanged (verbatim); translate only the dialogue text.
- Do NOT add, remove, merge, split, reorder, trim, wrap, or reflow lines; keep spacing and tags exactly as provided.
- Respond as strict JSON: {"lines":["line1","line2",...]} with the SAME length as input.
If you cannot preserve the exact line count, return an error message instead of altering structure.
`.trim();

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "Missing OPENAI_API_KEY" },
      { status: 500 }
    );
  }

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  let body: TranslateRequest;
  try {
    body = (await request.json()) as TranslateRequest;
  } catch (error) {
    console.error("[translate-batch] Invalid JSON body", { error });
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const lines = Array.isArray(body.lines) ? body.lines : [];
  const targetLanguage = body.targetLanguage || "Polish";
  const modelPreference = body.modelPreference || "auto";
  const movieTitle = body.movieTitle;
  const movieYear = body.movieYear;
  const movieOverview = body.movieOverview;
  if (lines.length === 0) {
    console.error("[translate-batch] No lines provided");
    return NextResponse.json(
      { ok: false, error: "No lines provided" },
      { status: 400 }
    );
  }

  const translateChunkOpenAI = async (
    chunk: string[],
    depth: number,
    attempt: number = 0
  ): Promise<{ ok: true; lines: string[] } | { ok: false; error: string }> => {
    try {
      console.log("[translate-batch] start", {
        model,
        lines: chunk.length,
        depth,
        first: chunk[0],
        last: chunk[chunk.length - 1],
      });

      const completion = await openai.chat.completions.create({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              instructions: `Translate lines to ${targetLanguage}; preserve indices/timecodes/blank/markup lines verbatim; output JSON with the same number of lines.`,
              expectedCount: chunk.length,
              movie: {
                title: movieTitle ?? null,
                year: movieYear ?? null,
                overview: movieOverview ?? null,
              },
              lines: chunk,
            }),
          },
        ],
      });

      const content = completion.choices?.[0]?.message?.content ?? "";

      let parsed: { lines?: string[] };
      try {
        parsed = JSON.parse(content);
      } catch {
        console.error("[translate-batch] Non-JSON response", {
          content,
          depth,
          size: chunk.length,
        });
        return { ok: false, error: "Model returned non-JSON output" };
      }

      const translatedLines = parsed.lines;

      if (!Array.isArray(translatedLines)) {
        console.error("[translate-batch] Missing lines array in response", {
          parsed,
          depth,
          size: chunk.length,
        });
        return { ok: false, error: "Model response missing lines array" };
      }

      if (translatedLines.length !== chunk.length) {
        console.error("[translate-batch] Line count mismatch", {
          expected: chunk.length,
          got: translatedLines.length,
          depth,
          size: chunk.length,
        });

        // Fallback: split and retry smaller batches to preserve structure
        if (chunk.length > 1 && depth < 4) {
          const mid = Math.floor(chunk.length / 2);
          const left = await translateChunkOpenAI(chunk.slice(0, mid), depth + 1);
          if (!left.ok) return left;
          const right = await translateChunkOpenAI(chunk.slice(mid), depth + 1);
          if (!right.ok) return right;
          return { ok: true, lines: [...left.lines, ...right.lines] };
        }

        // Repair fallback: backfill missing or extra lines with originals to keep count
        const repaired = Array.from({ length: chunk.length }, (_, idx) => {
          return translatedLines[idx] !== undefined ? translatedLines[idx] : chunk[idx];
        });
        console.warn("[translate-batch] Repaired line count mismatch", {
          expected: chunk.length,
          got: translatedLines.length,
          depth,
          size: chunk.length,
        });
        return { ok: true, lines: repaired };
      }

      return { ok: true, lines: translatedLines };
    } catch (error: any) {
      const status = error?.status;
      const isRetryable = status === 429 || status === 503;
      const message =
        error instanceof Error ? error.message : "Unable to translate";
      console.error("[translate-batch] Translation error", { error, status, depth, size: chunk.length });

      if (isRetryable && attempt < 3) {
        const backoff = 500 * Math.pow(2, attempt); // 0.5s, 1s, 2s
        console.warn("[translate-batch] retrying after backoff", { backoff, attempt: attempt + 1 });
        await new Promise((resolve) => setTimeout(resolve, backoff));
        return translateChunkOpenAI(chunk, depth, attempt + 1);
      }

      return { ok: false, error: status ? `Upstream error ${status}: ${message}` : message };
    }
  };

  const translateChunkClaude = async (
    chunk: string[]
  ): Promise<{ ok: true; lines: string[]; modelUsed: string } | { ok: false; error: string }> => {
    if (!anthropic) return { ok: false, error: "Claude client not configured" };
    const prompt = JSON.stringify({
      instructions: `Translate lines to ${targetLanguage}; preserve indices/timecodes/blank/markup lines verbatim; output JSON with the same number of lines.`,
      expectedCount: chunk.length,
      movie: {
        title: movieTitle ?? null,
        year: movieYear ?? null,
        overview: movieOverview ?? null,
      },
      lines: chunk,
    });

    for (const claudeModel of CLAUDE_MODELS) {
      try {
        const completion = await anthropic.messages.create({
          model: claudeModel,
          temperature: 0.1,
          max_tokens: 4000,
          system: `${SYSTEM_PROMPT}\nReturn strictly JSON: {"lines":["line1","line2",...]}`,
          messages: [{ role: "user", content: prompt }],
        });

        const content =
          completion.content?.[0]?.type === "text" ? completion.content[0].text : "";

        let parsed: { lines?: string[] };
        try {
          parsed = JSON.parse(content);
        } catch {
          console.error("[translate-batch] Claude non-JSON response", { content, claudeModel });
          continue;
        }

        const translatedLines = parsed.lines;
        if (!Array.isArray(translatedLines)) {
          continue;
        }
        if (translatedLines.length !== chunk.length) {
          continue;
        }

        return { ok: true, lines: translatedLines, modelUsed: claudeModel };
      } catch (error: any) {
        const status = error?.status;
        const message = error instanceof Error ? error.message : "Claude translate failed";
        // If model not found, try next in list; otherwise stop.
        if (!(status === 404 || message.includes("not_found"))) {
          console.error("[translate-batch] Claude error", { error: message, claudeModel });
          return { ok: false, error: message };
        }
      }
    }

    return { ok: false, error: "Claude models unavailable (not_found)" };
  };

  // Model routing
  let result: { ok: true; lines: string[]; modelUsed?: string } | { ok: false; error: string };
  let modelUsed = model;

  if (modelPreference === "claude") {
    result = await translateChunkClaude(lines);
    modelUsed = result.ok ? result.modelUsed || CLAUDE_MODELS[0] : CLAUDE_MODELS[0];
  } else if (modelPreference === "openai") {
    result = await translateChunkOpenAI(lines, 0);
    modelUsed = model;
  } else {
    // auto: try OpenAI then Claude
    const openaiResult = await translateChunkOpenAI(lines, 0);
    if (openaiResult.ok) {
      result = openaiResult;
      modelUsed = model;
    } else {
      const claudeResult = await translateChunkClaude(lines);
      result = claudeResult;
      modelUsed = claudeResult.ok ? claudeResult.modelUsed || CLAUDE_MODELS[0] : model;
      if (!claudeResult.ok) {
        return NextResponse.json({ ok: false, error: claudeResult.error }, { status: 500 });
      }
    }
  }

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    lines: result.lines,
    model: modelUsed,
    targetLanguage,
  });
}

