import { MovieListGate } from "@/components/MovieListGate";

type MovieRow = {
  title: string;
  release_year: number | null;
  poster_path: string | null;
  overview: string | null;
  external_link: string | null;
};

type Movie = {
  title: string;
  release_year?: number | null;
  poster_path?: string | null;
  overview?: string | null;
  external_link?: string | null;
};

const fetchMovie = async (query: string): Promise<Movie | null> => {
  const token = process.env.TMDB_READ_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;
  if (!token && !apiKey) return null;

  const url = new URL("https://api.themoviedb.org/3/search/movie");
  url.searchParams.set("query", query);
  url.searchParams.set("language", "en-US");
  url.searchParams.set("include_adult", "false");
  if (!token && apiKey) {
    url.searchParams.set("api_key", apiKey);
  }

  const res = await fetch(url.toString(), {
    headers: token
      ? {
          accept: "application/json",
          Authorization: `Bearer ${token}`,
        }
      : { accept: "application/json" },
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!res.ok) return null;
  const data = await res.json();
  const first = Array.isArray(data.results) && data.results.length > 0 ? data.results[0] : null;
  if (!first) return null;
  return {
    title: first.title,
    release_year: first.release_date ? Number(first.release_date.slice(0, 4)) : null,
    poster_path: first.poster_path,
    overview: first.overview,
  };
};

export default async function Home() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let rows: MovieRow[] = [];
  if (supabaseUrl && supabaseKey) {
    const res = await fetch(`${supabaseUrl}/rest/v1/curated_movies?select=*`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      rows = (await res.json()) as MovieRow[];
    }
  }

  const results = await Promise.all(
    rows.map(async (row) => {
      let merged: Movie = {
        title: row.title,
        release_year: row.release_year,
        poster_path: row.poster_path,
        overview: row.overview,
        external_link: row.external_link,
      };
      // backfill from TMDB if missing poster/overview
      if (!row.poster_path || !row.overview) {
        const fallback = await fetchMovie(row.title);
        if (fallback) {
          merged = {
            ...merged,
            poster_path: merged.poster_path ?? fallback.poster_path ?? null,
            overview: merged.overview ?? fallback.overview ?? null,
            release_year: merged.release_year ?? fallback.release_year ?? null,
          };
        }
      }
      return merged;
    })
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="flex flex-col gap-3">
          <h1 className="text-5xl font-semibold text-white">Global Cinema</h1>
          <p className="text-lg text-zinc-400">Curated films by Rafid Hoda</p>
        </header>

        <main>
          <MovieListGate results={results} />
        </main>
      </div>
    </div>
  );
}
