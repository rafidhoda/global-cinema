import { NextResponse } from "next/server";
import { MOVIES, type Movie } from "@/lib/movies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Trim in case of copy-paste whitespace (e.g. from rafidhoda.com env)
const TMDB_API_KEY = process.env.TMDB_API_KEY?.trim() ?? "";
const TMDB_READ_TOKEN = process.env.TMDB_READ_TOKEN?.trim() ?? "";
const POSTER_BASE = "https://image.tmdb.org/t/p/w500";

async function fetchPosterPath(title: string, year: number): Promise<string | null> {
  if (!TMDB_API_KEY && !TMDB_READ_TOKEN) return null;

  const baseUrl = "https://api.themoviedb.org/3/search/movie";

  const attempt = (useApiKey: boolean): { url: URL; headers: HeadersInit } => {
    const url = new URL(baseUrl);
    url.searchParams.set("query", title);
    url.searchParams.set("language", "en-US");
    url.searchParams.set("include_adult", "false");
    url.searchParams.set("primary_release_year", String(year));
    if (useApiKey && TMDB_API_KEY) {
      url.searchParams.set("api_key", TMDB_API_KEY);
    }
    const headers: HeadersInit = { accept: "application/json" };
    if (!useApiKey && TMDB_READ_TOKEN) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${TMDB_READ_TOKEN}`;
    }
    return { url, headers };
  };

  // Try read token first (same as typical v4/Bearer setup), then API key on 401
  const tries: boolean[] = TMDB_READ_TOKEN ? [false] : [];
  if (TMDB_API_KEY) tries.push(true);

  for (const useApiKey of tries) {
    const { url, headers } = attempt(useApiKey);
    const res = await fetch(url.toString(), { headers, cache: "no-store" });
    if (!res.ok) {
      if (process.env.NODE_ENV === "development") {
        const text = await res.text();
        console.error("[movies] TMDB poster fetch failed", {
          title,
          year,
          status: res.status,
          auth: useApiKey ? "api_key" : "Bearer",
          body: text.slice(0, 200),
        });
      }
      if (res.status === 401 && tries.length > 1) continue;
      return null;
    }
    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];
    const match = results.find(
      (r: { release_date?: string }) =>
        r.release_date && r.release_date.startsWith(String(year))
    ) ?? results[0];
    return match?.poster_path ?? null;
  }
  return null;
}

export async function GET() {
  const withPosters: (Movie & { posterUrl: string })[] = [];
  for (const movie of MOVIES) {
    const posterPath = await fetchPosterPath(movie.title, movie.year);
    withPosters.push({
      ...movie,
      posterUrl: posterPath
        ? `${POSTER_BASE}${posterPath}`
        : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='750' viewBox='0 0 500 750'%3E%3Crect fill='%2327272a' width='500' height='750'/%3E%3Ctext fill='%2371717a' font-family='sans-serif' font-size='24' x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle'%3ENo poster%3C/text%3E%3C/svg%3E",
    });
  }
  return NextResponse.json({ movies: withPosters });
}
