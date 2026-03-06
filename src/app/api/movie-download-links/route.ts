import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TABLE = "movie_download_links";

/** GET: return { links: { [slug]: wormholeUrl } } for the app to merge with movie config */
export async function GET() {
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ links: {} });
  }
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data, error } = await supabase.from(TABLE).select("slug, wormhole_url");
  if (error) {
    console.error("[movie-download-links] GET", error);
    return NextResponse.json({ links: {} });
  }
  const links: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.slug && typeof row.wormhole_url === "string") {
      links[row.slug] = row.wormhole_url;
    }
  }
  return NextResponse.json({ links });
}
