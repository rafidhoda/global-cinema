import { MovieListGate } from "@/components/MovieListGate";

type Movie = {
  title: string;
  release_date?: string;
  poster_path?: string;
  overview?: string;
};

const MOVIES = [
  "Pad Man",
  "Dangal",
  "Before Sunrise",
  "Dilwale Dulhania Le Jayenge",
  "Bean",
  "Lagaan",
  "Munna Bhai M.B.B.S.",
  "Before Sunset",
  "Swades",
  "Idiocracy",
  "Taare Zameen Par",
  "3 Idiots",
  "Argo",
  "Before Midnight",
  "PK",
  "The Imitation Game",
  "Bajrangi Bhaijaan",
  "The Big Short",
  "The Man Who Knew Infinity",
  "The Martian",
  "The Founder",
  "Super 30",
  "83",
];

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
    release_date: first.release_date,
    poster_path: first.poster_path,
    overview: first.overview,
  };
};

export default async function Home() {
  const results = await Promise.all(
    MOVIES.map(async (title) => {
      const found = await fetchMovie(title);
      return { query: title, found };
    })
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="flex flex-col gap-3">
          <h1 className="text-5xl font-semibold text-white">Global Cinema</h1>
          <p className="text-lg text-zinc-300">Curated film picks with quick details. →</p>
          <p className="text-sm text-zinc-400">Curated films by Rafid Hoda.</p>
        </header>

        <main>
          <MovieListGate results={results} />
        </main>
      </div>
    </div>
  );
}
