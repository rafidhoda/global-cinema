import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseSrt } from "@/lib/srt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bucket = process.env.SUPABASE_MOVIES_BUCKET || "movies";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** One folder per movie: by-movie/{movieSlug}/{langSlug}.srt */
const BY_MOVIE_PREFIX = "by-movie/";
const FILE_SUFFIX = ".srt";

function slugToLabel(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

export async function GET(req: Request) {
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const movieSlug = searchParams.get("movieSlug")?.trim();
  if (!movieSlug) {
    return NextResponse.json(
      { error: "Missing movieSlug" },
      { status: 400 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const folder = `${BY_MOVIE_PREFIX}${movieSlug}`;
  const { data: files, error } = await supabase.storage
    .from(bucket)
    .list(folder, { limit: 50 });

  if (error) {
    // Folder may not exist yet (no created subtitles for this movie) — return empty
    console.warn("[movie-of-the-week-list] list error (folder may not exist)", {
      folder,
      message: error.message,
    });
    return NextResponse.json({ languages: [] });
  }

  const languages: { label: string; slug: string; url: string; cueCount: number }[] = [];

  for (const file of files ?? []) {
    if (!file.name?.endsWith(FILE_SUFFIX)) continue;
    const slug = file.name.slice(0, -FILE_SUFFIX.length);
    if (!slug) continue;
    const path = `${folder}/${file.name}`;
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    const url = pub?.publicUrl ?? "";
    let cueCount = 0;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        cueCount = parseSrt(text).length;
      }
    } catch {
      // leave cueCount 0
    }
    languages.push({
      label: slugToLabel(slug),
      slug,
      url,
      cueCount,
    });
  }

  return NextResponse.json({ languages });
}
