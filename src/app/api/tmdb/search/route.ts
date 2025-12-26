import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_READ_TOKEN = process.env.TMDB_READ_TOKEN;

export async function POST(req: Request) {
  if (!TMDB_API_KEY && !TMDB_READ_TOKEN) {
    console.error("[tmdb] credentials missing");
    return NextResponse.json(
      { ok: false, error: "TMDB credentials missing" },
      { status: 500 }
    );
  }

  let query: string | undefined;
  try {
    const body = await req.json();
    query = typeof body.query === "string" ? body.query.trim() : undefined;
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!query) {
    return NextResponse.json(
      { ok: false, error: "Query is required" },
      { status: 400 }
    );
  }

  const url = new URL("https://api.themoviedb.org/3/search/movie");
  url.searchParams.set("query", query);
  url.searchParams.set("language", "en-US");
  url.searchParams.set("include_adult", "false");

  const headers: Record<string, string> = {
    accept: "application/json",
  };
  if (TMDB_READ_TOKEN) {
    headers.Authorization = `Bearer ${TMDB_READ_TOKEN}`;
  } else if (TMDB_API_KEY) {
    url.searchParams.set("api_key", TMDB_API_KEY);
  }

  try {
    const searchOnce = async (q: string) => {
      const u = new URL("https://api.themoviedb.org/3/search/movie");
      u.searchParams.set("query", q);
      u.searchParams.set("language", "en-US");
      u.searchParams.set("include_adult", "false");
      if (!TMDB_READ_TOKEN && TMDB_API_KEY) {
        u.searchParams.set("api_key", TMDB_API_KEY);
      }
      const res = await fetch(u.toString(), { headers });
      if (!res.ok) {
        const text = await res.text();
        console.error("[tmdb] search failed", {
          status: res.status,
          body: text.slice(0, 500),
          url: u.toString(),
        });
        return { error: `TMDB error: ${res.status} ${text}` };
      }
      const data = await res.json();
      const results = Array.isArray(data.results) ? data.results : [];
      return { results };
    };

    let primary = await searchOnce(query);
    if (primary.error) {
      return NextResponse.json(
        { ok: false, error: primary.error },
        { status: 502 }
      );
    }

    // Fallback: if empty and query has a year, strip it and retry
    if (primary.results?.length === 0) {
      const withoutYear = query.replace(/\(\s*\d{4}\s*\)/, "").trim();
      if (withoutYear && withoutYear !== query) {
        console.warn("[tmdb] no results, retry without year", {
          query,
          retry: withoutYear,
        });
        const retry = await searchOnce(withoutYear);
        if (retry.error) {
          return NextResponse.json(
            { ok: false, error: retry.error },
            { status: 502 }
          );
        }
        if (retry.results?.length > 0) {
          primary = retry;
        }
      }
    }

    const results = primary.results ?? [];
    if (results.length === 0) {
      console.warn("[tmdb] no results after fallback", { query });
      return NextResponse.json({ ok: true, results: [] });
    }

    const first = results[0];
    return NextResponse.json({
      ok: true,
      results: results.slice(0, 5).map((r: any) => ({
        id: r.id,
        title: r.title,
        original_title: r.original_title,
        overview: r.overview,
        release_date: r.release_date,
        poster_path: r.poster_path,
        vote_average: r.vote_average,
      })),
      first,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TMDB request failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

