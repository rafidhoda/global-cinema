import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bucket = process.env.SUPABASE_SUBTITLES_BUCKET || "subtitles";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: Request) {
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { ok: false, error: "Supabase URL or service role key missing" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  let movieId = "";
  let language = "en";
  try {
    const body = await req.json();
    movieId = body.movieId || "";
    language = body.language || "en";
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!movieId) {
    return NextResponse.json(
      { ok: false, error: "movieId is required" },
      { status: 400 }
    );
  }

  const prefixes = [
    `movies/${movieId}/${language}`, // expected structure
    `${language}`, // legacy flat language folder
    `${language}/${movieId}`, // legacy variant
  ];

  for (const prefix of prefixes) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 10,
      sortBy: { column: "created_at", order: "desc" },
    });

    if (error) {
      continue;
    }

    if (!data || data.length === 0) {
      continue;
    }

    const first = data[0];
    const fullPath = `${prefix}/${first.name}`;
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(fullPath, {
      download: fullPath.endsWith(".srt") ? fullPath.split("/").pop() : true,
    });

    return NextResponse.json({
      ok: true,
      url: pub?.publicUrl || null,
      path: fullPath,
    });
  }

  return NextResponse.json({ ok: true, url: null, path: null });
}

