import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = "RafidHoda";
const bucket = process.env.SUPABASE_MOVIES_BUCKET || "movies";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BY_MOVIE_PREFIX = "by-movie/";

function slugFromTitleAndYear(title: string, year: number): string {
  const base = title.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return `${base}-${year}`;
}

function safeFileName(title: string, year: number): string {
  return `${title.trim()} (${year})`;
}

export async function POST(req: Request) {
  const auth =
    req.headers.get("x-admin-password")?.trim() ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (auth !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const title = formData.get("title")?.toString()?.trim();
  const yearRaw = formData.get("year")?.toString()?.trim();
  const mp4File = formData.get("mp4") as File | null;
  const srtFile = formData.get("subtitles") as File | null;

  if (!title || !yearRaw) {
    return NextResponse.json(
      { error: "Title and year are required" },
      { status: 400 }
    );
  }

  const year = parseInt(yearRaw, 10);
  if (Number.isNaN(year) || year < 1900 || year > 2100) {
    return NextResponse.json(
      { error: "Year must be a number between 1900 and 2100" },
      { status: 400 }
    );
  }

  if (!mp4File || !(mp4File instanceof File) || mp4File.size === 0) {
    return NextResponse.json(
      { error: "MP4 file is required" },
      { status: 400 }
    );
  }

  if (!srtFile || !(srtFile instanceof File) || srtFile.size === 0) {
    return NextResponse.json(
      { error: "English subtitles (SRT) file is required" },
      { status: 400 }
    );
  }

  const baseName = safeFileName(title, year);
  const slug = slugFromTitleAndYear(title, year);
  const mp4Path = `${baseName}.mp4`;
  const srtPathRoot = `${baseName} - English.srt`;
  const srtPathByMovie = `${BY_MOVIE_PREFIX}${slug}/english.srt`;

  const supabase = createClient(supabaseUrl, serviceKey);

  const mp4Buffer = Buffer.from(await mp4File.arrayBuffer());
  const { error: mp4Error } = await supabase.storage.from(bucket).upload(mp4Path, mp4Buffer, {
    contentType: "video/mp4",
    upsert: true,
  });
  if (mp4Error) {
    console.error("[admin/upload-movie] mp4 upload", mp4Error);
    return NextResponse.json({ error: mp4Error.message }, { status: 500 });
  }

  const srtBuffer = Buffer.from(await srtFile.arrayBuffer());
  const { error: srtRootError } = await supabase.storage.from(bucket).upload(srtPathRoot, srtBuffer, {
    contentType: "application/x-subrip",
    upsert: true,
  });
  if (srtRootError) {
    console.error("[admin/upload-movie] srt root upload", srtRootError);
    return NextResponse.json({ error: srtRootError.message }, { status: 500 });
  }

  const { error: srtByMovieError } = await supabase.storage.from(bucket).upload(srtPathByMovie, srtBuffer, {
    contentType: "application/x-subrip",
    upsert: true,
  });
  if (srtByMovieError) {
    console.error("[admin/upload-movie] srt by-movie upload", srtByMovieError);
    // non-fatal: root SRT is enough for playback
  }

  const { data: videoPub } = supabase.storage.from(bucket).getPublicUrl(mp4Path);
  const { data: srtPub } = supabase.storage.from(bucket).getPublicUrl(srtPathRoot);

  return NextResponse.json({
    ok: true,
    slug,
    title,
    year,
    videoUrl: videoPub?.publicUrl ?? "",
    englishSrtUrl: srtPub?.publicUrl ?? "",
    subtitleUrl: `/api/subtitles/vtt?url=${encodeURIComponent(srtPub?.publicUrl ?? "")}`,
  });
}
