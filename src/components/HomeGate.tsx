"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const AUTH_KEY = "global-cinema-auth";
const PASSWORD = "hoda";

type MovieWithPoster = {
  slug: string;
  title: string;
  year: number;
  posterUrl: string;
};

export function HomeGate() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [movies, setMovies] = useState<MovieWithPoster[]>([]);
  const [moviesLoading, setMoviesLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setAuthed(localStorage.getItem(AUTH_KEY) === PASSWORD);
  }, []);

  useEffect(() => {
    if (!authed) return;
    setMoviesLoading(true);
    fetch("/api/movies")
      .then((res) => (res.ok ? res.json() : { movies: [] }))
      .then((data) => setMovies(data?.movies ?? []))
      .catch(() => setMovies([]))
      .finally(() => setMoviesLoading(false));
  }, [authed]);

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      if (password.trim() === PASSWORD) {
        localStorage.setItem(AUTH_KEY, PASSWORD);
        setAuthed(true);
      } else {
        setError("Wrong password");
      }
    },
    [password]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    setAuthed(false);
  }, []);

  if (authed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-white" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4">
        <form
          onSubmit={submit}
          className="w-full max-w-sm space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/80 p-8"
        >
          <h1 className="text-center text-xl font-semibold text-white">
            Global Cinema
          </h1>
          <p className="text-center text-sm text-zinc-400">
            Enter the password to continue
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            autoFocus
          />
          {error && (
            <p className="text-center text-sm text-rose-400">{error}</p>
          )}
          <button
            type="submit"
            className="w-full cursor-pointer rounded-lg bg-emerald-600 py-3 font-medium text-white transition hover:bg-emerald-500"
          >
            Enter
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 flex justify-center">
        <button
          type="button"
          onClick={logout}
          className="cursor-pointer text-sm text-zinc-400 underline transition hover:text-zinc-300"
        >
          Log out
        </button>
      </div>
      {moviesLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-white" />
        </div>
      ) : (
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 md:grid-cols-4">
          {movies.map((movie) => (
            <Link
              key={movie.slug}
              href={`/${movie.slug}`}
              className="group block cursor-pointer overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 transition hover:border-zinc-600"
            >
              <div className="aspect-[2/3] overflow-hidden bg-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={movie.posterUrl}
                  alt={movie.title}
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              </div>
              <div className="p-3">
                <p className="font-medium text-white group-hover:text-emerald-400">
                  {movie.title}
                </p>
                <p className="text-sm text-zinc-500">{movie.year}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
