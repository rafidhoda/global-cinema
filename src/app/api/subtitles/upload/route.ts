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

  const formData = await req.formData();
  const movieId = formData.get("movieId") as string;
  const language = (formData.get("language") as string) || "en";
  const file = formData.get("file") as File | null;

  if (!movieId || !file) {
    return NextResponse.json({ ok: false, error: "movieId and file are required" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);
  const baseName = file.name.replace(/\.[^.]+$/, "") || "subtitles";
  const safeName = `${Date.now()}-${baseName}-${language}.srt`;
  const path = `movies/${movieId}/${language}/${safeName}`;

  const { error } = await supabase.storage.from(bucket).upload(path, fileBuffer, {
    contentType: "application/x-subrip",
    upsert: true,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path, { download: true });
  return NextResponse.json({ ok: true, url: pub?.publicUrl || null, path });
}

