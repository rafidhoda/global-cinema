import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = "RafidHoda";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TABLE = "movie_download_links";

/** POST: save or update wormhole URL for a movie slug. Body: { slug, wormholeUrl } */
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

  let body: { slug?: string; wormholeUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = body.slug?.trim();
  const wormholeUrl = typeof body.wormholeUrl === "string" ? body.wormholeUrl.trim() : "";

  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { error } = await supabase.from(TABLE).upsert(
    { slug, wormhole_url: wormholeUrl, updated_at: new Date().toISOString() },
    { onConflict: "slug" }
  );

  if (error) {
    console.error("[admin/movie-download-link]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, slug, wormholeUrl });
}
