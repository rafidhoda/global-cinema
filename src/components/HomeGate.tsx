"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { nativeLanguageToCode, getUiStrings } from "@/lib/i18n";
import type { Movie } from "@/lib/movies";

const AUTH_KEY = "global-cinema-auth";
const FIRST_NAME_KEY = "global-cinema-first-name";
const NATIVE_LANGUAGE_KEY = "global-cinema-native-language";
const PASSWORD_ADMIN = "hoda";
const PASSWORD_BOLLYWOOD = "bollywood";

type MovieWithPoster = Movie & {
  posterUrl: string;
  titleLocalized?: string;
  overviewLocalized?: string;
};

export function HomeGate() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [movies, setMovies] = useState<MovieWithPoster[]>([]);
  const [moviesLoading, setMoviesLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const auth = localStorage.getItem(AUTH_KEY);
    setAuthed(auth === PASSWORD_ADMIN || auth === PASSWORD_BOLLYWOOD);
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

  const submitPassword = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    const value = password.trim();
    if (value === PASSWORD_BOLLYWOOD) {
      localStorage.setItem(AUTH_KEY, PASSWORD_BOLLYWOOD);
      localStorage.setItem(FIRST_NAME_KEY, "Guest");
      localStorage.setItem(NATIVE_LANGUAGE_KEY, "English");
      setAuthed(true);
      setPassword("");
    } else {
      setPasswordError("Wrong password");
    }
  }, [password]);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(FIRST_NAME_KEY);
    localStorage.removeItem(NATIVE_LANGUAGE_KEY);
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-black px-6">
        <h1 className="text-center text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl">
          Global Cinema
        </h1>
        <form onSubmit={submitPassword} className="flex w-full max-w-md flex-col gap-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-6 py-5 text-center text-xl text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 sm:py-6 sm:text-2xl"
            autoFocus
          />
          <button
            type="submit"
            className="w-full cursor-pointer rounded-2xl bg-amber-500 px-6 py-5 text-xl font-medium text-black transition hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-black sm:py-6 sm:text-2xl"
          >
            Enter
          </button>
          {passwordError && (
            <p className="text-center text-sm text-rose-400">{passwordError}</p>
          )}
        </form>
      </div>
    );
  }

  const storedNativeLanguage =
    typeof window !== "undefined" ? localStorage.getItem(NATIVE_LANGUAGE_KEY) || "" : "";
  const langCode = nativeLanguageToCode(storedNativeLanguage);
  const ui = getUiStrings(langCode);

  return (
    <div className="min-h-screen bg-black px-5 py-10 sm:px-8 sm:py-14">
      <div className="mb-10 flex justify-center">
        <button
          type="button"
          onClick={logout}
          className="cursor-pointer text-base text-zinc-400 underline transition hover:text-zinc-300"
        >
          {ui.logOut}
        </button>
      </div>
      {moviesLoading ? (
        <div className="flex justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-600 border-t-white" />
        </div>
      ) : (
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {movies.map((movie) => (
            <Link
              key={movie.slug}
              href={`/${movie.slug}`}
              className="group block overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 transition hover:border-zinc-600 hover:bg-zinc-900"
            >
              <div className="aspect-[2/3] w-full overflow-hidden bg-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={movie.posterUrl}
                  alt={movie.titleLocalized || movie.title}
                  className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
                />
              </div>
              <div className="p-5">
                <h2 className="text-xl font-semibold text-white sm:text-2xl">
                  {movie.titleLocalized || movie.title}
                </h2>
                <p className="mt-1 text-zinc-500">{movie.year}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
