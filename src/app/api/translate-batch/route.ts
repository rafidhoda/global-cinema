import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type TranslateRequest = {
  lines: string[];
  targetLanguage?: string;
};

const SYSTEM_PROMPT = `
You are an expert subtitle translator.
Movie context: "Dangal" (2016) Bollywood film. Translate naturally (not literal) while preserving story and tone into the target language.
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

  const model = process.env.OPENAI_MODEL || "gpt-4.1";

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
  if (lines.length === 0) {
    console.error("[translate-batch] No lines provided");
    return NextResponse.json(
      { ok: false, error: "No lines provided" },
      { status: 400 }
    );
  }

  const translateChunk = async (
    chunk: string[],
    depth: number
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
          const left = await translateChunk(chunk.slice(0, mid), depth + 1);
          if (!left.ok) return left;
          const right = await translateChunk(chunk.slice(mid), depth + 1);
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
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to translate";
      console.error("[translate-batch] Translation error", { error, depth, size: chunk.length });
      return { ok: false, error: message };
    }
  };

  const result = await translateChunk(lines, 0);

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, lines: result.lines, model, targetLanguage });
}

