import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TABLE = "movie_download_links";

/** Server-side: fetch stored wormhole URLs by slug. Returns { [slug]: url }. */
export async function getMovieDownloadLinks(): Promise<Record<string, string>> {
  if (!supabaseUrl || !serviceKey) return {};
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data, error } = await supabase.from(TABLE).select("slug, wormhole_url");
  if (error) return {};
  const links: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.slug && typeof row.wormhole_url === "string") {
      links[row.slug] = row.wormhole_url;
    }
  }
  return links;
}
