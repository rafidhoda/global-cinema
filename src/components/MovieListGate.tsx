"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Movie = {
  title?: string;
  release_year?: number | null;
  poster_path?: string | null;
  overview?: string | null;
  external_link?: string | null;
};

export function MovieListGate({ results }: { results: Movie[] }) {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [openMovie, setOpenMovie] = useState<Movie | null>(null);

  // Load saved state from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("gc_pass_ok");
    if (saved === "true") {
      setUnlocked(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "hoda") {
      setUnlocked(true);
      if (typeof window !== "undefined") {
        localStorage.setItem("gc_pass_ok", "true");
      }
    } else {
      setUnlocked(false);
    }
  };

  if (!unlocked) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 shadow-lg max-w-xl">
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <h2 className="text-lg font-semibold text-white">Enter password to view films</h2>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            placeholder="Password"
          />
          <button
            type="submit"
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          >
            Unlock
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {results.map((movie) => {
        const href = movie.external_link ?? undefined;
        const Card = (
          <div className="flex gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 shadow-lg">
            <div className="relative h-32 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-900">
              {movie.poster_path ? (
                <Image
                  src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
                  alt={movie.title || "Movie poster"}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
                  No poster
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-white">
                  {movie.title}
                  {movie.release_year ? ` (${movie.release_year})` : ""}
                </h2>
                <p className="text-xs text-zinc-400 line-clamp-4">
                  {movie.overview || "No synopsis available."}
                </p>
              </div>
            </div>
          </div>
        );

        if (href) {
          return (
            <button
              key={movie.title}
              onClick={() => setOpenMovie(movie)}
              className="transition hover:-translate-y-1 hover:shadow-emerald-500/20 text-left"
            >
              {Card}
            </button>
          );
        }

        return (
          <button
            key={movie.title}
            onClick={() => setOpenMovie(movie)}
            className="transition hover:-translate-y-1 hover:shadow-emerald-500/20 text-left"
          >
            {Card}
          </button>
        );
      })}

      {openMovie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <h3 className="text-lg font-semibold text-zinc-100">
                {openMovie.title}
                {openMovie.release_year ? ` (${openMovie.release_year})` : ""}
              </h3>
              <button
                type="button"
                onClick={() => setOpenMovie(null)}
                className="rounded bg-zinc-800 px-3 py-1 text-sm text-zinc-100 transition hover:bg-zinc-700"
              >
                Close
              </button>
            </div>
            <div className="flex flex-col gap-4 p-4 sm:flex-row">
              <div className="relative h-64 w-44 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-900">
                {openMovie.poster_path ? (
                  <Image
                    src={`https://image.tmdb.org/t/p/w342${openMovie.poster_path}`}
                    alt={openMovie.title || "Poster"}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
                    No poster
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-4">
                <p className="text-sm text-zinc-300">
                  {openMovie.overview || "No synopsis available."}
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (openMovie.external_link) {
                        window.open(openMovie.external_link, "_blank", "noopener,noreferrer");
                      }
                    }}
                    disabled={!openMovie.external_link}
                    className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Download Movie
                  </button>
                  <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                    <div className="text-sm font-semibold text-zinc-100">Subtitles</div>
                    <div className="flex gap-3 text-xs text-zinc-400">
                      <button
                        type="button"
                        disabled
                        className="rounded bg-zinc-800 px-3 py-2 text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        English
                      </button>
                      <button
                        type="button"
                        disabled
                        className="rounded bg-zinc-800 px-3 py-2 text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Polish
                      </button>
                    </div>
                    <p className="text-xs text-zinc-500">
                      (Subtitles download links can be wired here.)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

