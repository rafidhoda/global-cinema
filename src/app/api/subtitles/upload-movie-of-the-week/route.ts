import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bucket = process.env.SUPABASE_MOVIES_BUCKET || "movies";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Path: by-movie/{movieSlug}/{langSlug}.srt — one folder per movie. */
const BY_MOVIE_PREFIX = "by-movie/";

function slugForLanguage(language: string): string {
  return language.toLowerCase().replace(/\s+/g, "-");
}

function pathFor(movieSlug: string, langSlug: string): string {
  return `${BY_MOVIE_PREFIX}${movieSlug}/${langSlug}.srt`;
}

/** GET: fetch existing subtitle file for a language (for resume). Returns 404 if none. */
export async function GET(req: Request) {
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const movieSlug = searchParams.get("movieSlug")?.trim();
  const language = searchParams.get("language")?.trim();
  if (!movieSlug || !language) {
    return NextResponse.json(
      { error: "Missing movieSlug or language" },
      { status: 400 }
    );
  }

  const langSlug = slugForLanguage(language);
  const path = pathFor(movieSlug, langSlug);

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data, error } = await supabase.storage.from(bucket).download(path);

  if (error || !data) {
    return new NextResponse(null, { status: 404 });
  }

  const text = await data.text();
  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req: Request) {
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { ok: false, error: "Supabase URL or service role key missing" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  let body: { movieSlug?: string; language: string; content: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const movieSlug = body.movieSlug?.trim();
  const language = body.language?.trim();
  const content = typeof body.content === "string" ? body.content : "";

  if (!movieSlug || !language) {
    return NextResponse.json(
      { ok: false, error: "movieSlug and language are required" },
      { status: 400 }
    );
  }

  const langSlug = slugForLanguage(language);
  const path = pathFor(movieSlug, langSlug);

  const buffer = Buffer.from(content, "utf-8");

  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType: "application/x-subrip",
    upsert: true,
  });

  if (error) {
    console.error("[upload-movie-of-the-week]", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
  return NextResponse.json({
    ok: true,
    url: pub?.publicUrl ?? null,
    path,
  });
}
