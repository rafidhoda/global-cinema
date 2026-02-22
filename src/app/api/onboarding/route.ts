import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Table: onboarding_visitors (first_name, native_language, created_at) */
const TABLE = "onboarding_visitors";

export async function POST(req: Request) {
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  let body: { first_name?: string; native_language?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const first_name = typeof body.first_name === "string" ? body.first_name.trim() : "";
  const native_language = typeof body.native_language === "string" ? body.native_language.trim() : "";

  if (!first_name || !native_language) {
    return NextResponse.json(
      { error: "first_name and native_language are required" },
      { status: 400 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { error } = await supabase.from(TABLE).insert({
    first_name,
    native_language,
  });

  if (error) {
    console.error("[onboarding] insert error", error);
    return NextResponse.json(
      { error: error.message },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
