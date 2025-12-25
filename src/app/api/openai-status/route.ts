import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET() {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "Missing OPENAI_API_KEY" },
      { status: 500 }
    );
  }

  try {
    const model = process.env.OPENAI_MODEL || "gpt-4.1";
    await openai.models.retrieve(model);

    return NextResponse.json({ ok: true, model });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to reach OpenAI";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

