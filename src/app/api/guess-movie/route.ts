import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "Missing OPENAI_API_KEY" },
      { status: 500 }
    );
  }

  let filename = "";
  try {
    const body = await req.json();
    filename = typeof body.filename === "string" ? body.filename : "";
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!filename.trim()) {
    return NextResponse.json(
      { ok: false, error: "Filename is required" },
      { status: 400 }
    );
  }

  const prompt = `
You are a movie title guesser. Given a subtitle filename, infer the most likely movie title and year.
Respond strictly as JSON: {"title":"...","year":"...."}.
If unsure, return a best guess; omit year if unknown.
Filename: ${filename}
`.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return only JSON with title and optional year." },
        { role: "user", content: prompt },
      ],
    });

    const content = completion.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content);
    return NextResponse.json({ ok: true, guess: parsed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to guess movie";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

