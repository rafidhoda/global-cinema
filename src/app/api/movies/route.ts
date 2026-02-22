import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { MOVIES, type Movie } from "@/lib/movies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Trim in case of copy-paste whitespace (e.g. from rafidhoda.com env)
const TMDB_API_KEY = process.env.TMDB_API_KEY?.trim() ?? "";
const TMDB_READ_TOKEN = process.env.TMDB_READ_TOKEN?.trim() ?? "";
const POSTER_BASE = "https://image.tmdb.org/t/p/w500";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
const MOVIES_BUCKET = process.env.SUPABASE_MOVIES_BUCKET || "movies";
const BY_MOVIE_PREFIX = "by-movie/";

type SearchResult = { poster_path: string | null; id: number } | null;

async function fetchSearchResult(title: string, year: number): Promise<SearchResult> {
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
    if (match && (match.poster_path != null || match.id != null))
      return { poster_path: match.poster_path ?? null, id: match.id };
  }
  return null;
}

/** Normalize to TMDB-style language (e.g. da-DK). Falls back to en-US. */
function toTmdbLang(code: string): string {
  const c = code.trim().toLowerCase().slice(0, 2);
  const map: Record<string, string> = {
    da: "da-DK",
    sv: "sv-SE",
    ru: "ru-RU",
    bn: "bn-IN",
    pl: "pl-PL",
    no: "no-NO",
    lt: "lt-LT",
    hi: "hi-IN",
    fr: "fr-FR",
    de: "de-DE",
  };
  return map[c] ?? (c ? `${c}-${c.toUpperCase()}` : "en-US");
}

async function fetchMovieDetails(
  movieId: number,
  lang: string
): Promise<{ title: string; overview: string } | null> {
  if (!TMDB_API_KEY && !TMDB_READ_TOKEN) return null;
  const langParam = toTmdbLang(lang);
  const url = new URL(`https://api.themoviedb.org/3/movie/${movieId}`);
  url.searchParams.set("language", langParam);
  if (TMDB_API_KEY) url.searchParams.set("api_key", TMDB_API_KEY);
  const headers: HeadersInit = { accept: "application/json" };
  if (TMDB_READ_TOKEN)
    (headers as Record<string, string>)["Authorization"] = `Bearer ${TMDB_READ_TOKEN}`;
  const res = await fetch(url.toString(), { headers, cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    title: typeof data.title === "string" ? data.title : "",
    overview: typeof data.overview === "string" ? data.overview : "",
  };
}

const PLACEHOLDER_POSTER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='750' viewBox='0 0 500 750'%3E%3Crect fill='%2327272a' width='500' height='750'/%3E%3Ctext fill='%2371717a' font-family='sans-serif' font-size='24' x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle'%3ENo poster%3C/text%3E%3C/svg%3E";

/** Returns true if by-movie/{movieSlug}/{subtitleLang}.srt exists. */
async function movieHasSubtitleInLanguage(
  movieSlug: string,
  subtitleLang: string
): Promise<boolean> {
  if (!supabaseUrl || !supabaseServiceKey) return false;
  const path = `${BY_MOVIE_PREFIX}${movieSlug}/${subtitleLang}.srt`;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: files, error } = await supabase.storage
    .from(MOVIES_BUCKET)
    .list(`${BY_MOVIE_PREFIX}${movieSlug}`, { limit: 200 });
  if (error || !files) return false;
  const expected = `${subtitleLang}.srt`;
  return files.some((f) => f.name === expected);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lang = searchParams.get("lang")?.trim() || "";
  const subtitleLang = searchParams.get("subtitleLang")?.trim()?.toLowerCase() || "";

  const withPosters: (Movie & {
    posterUrl: string;
    titleLocalized?: string;
    overviewLocalized?: string;
  })[] = [];

  for (const movie of MOVIES) {
    if (subtitleLang) {
      const hasSubs = await movieHasSubtitleInLanguage(movie.slug, subtitleLang);
      if (!hasSubs) continue;
    }

    const search = await fetchSearchResult(movie.title, movie.year);
    const posterUrl = search?.poster_path
      ? `${POSTER_BASE}${search.poster_path}`
      : PLACEHOLDER_POSTER;

    const entry: Movie & {
      posterUrl: string;
      titleLocalized?: string;
      overviewLocalized?: string;
    } = { ...movie, posterUrl };

    if (lang && search?.id) {
      const details = await fetchMovieDetails(search.id, lang);
      if (details) {
        entry.titleLocalized = details.title || movie.title;
        entry.overviewLocalized = details.overview || "";
      }
    }

    withPosters.push(entry);
  }

  return NextResponse.json({ movies: withPosters });
}
