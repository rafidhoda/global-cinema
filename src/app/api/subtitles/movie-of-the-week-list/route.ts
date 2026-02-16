import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseSrt } from "@/lib/srt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bucket = process.env.SUPABASE_MOVIES_BUCKET || "movies";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PREFIX = "movie-of-the-week/";
const FILE_PREFIX = "taare-zameen-par-2007-";
const FILE_SUFFIX = ".srt";

function slugToLabel(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

export async function GET() {
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: files, error } = await supabase.storage
    .from(bucket)
    .list("movie-of-the-week", { limit: 50 });

  if (error) {
    console.error("[movie-of-the-week-list]", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const languages: { label: string; slug: string; url: string; cueCount: number }[] = [];

  for (const file of files ?? []) {
    if (!file.name?.startsWith(FILE_PREFIX) || !file.name?.endsWith(FILE_SUFFIX)) continue;
    const slug = file.name.slice(FILE_PREFIX.length, -FILE_SUFFIX.length);
    if (!slug) continue;
    const path = `${PREFIX}${file.name}`;
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
