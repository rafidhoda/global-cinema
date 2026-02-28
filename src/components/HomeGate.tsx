"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { nativeLanguageToCode, nativeLanguageToSubtitleSlug, getUiStrings } from "@/lib/i18n";

const AUTH_KEY = "global-cinema-auth";
const FIRST_NAME_KEY = "global-cinema-first-name";
const NATIVE_LANGUAGE_KEY = "global-cinema-native-language";
const PASSWORD_ADMIN = "hoda";
const PASSWORD_BOLLYWOOD = "bollywood";

const LANDING_LANGUAGES = [
  { name: "English", value: "English" },
  { name: "Polski", value: "Polish" },
  { name: "Norsk", value: "Norwegian" },
] as const;

type MovieWithPoster = {
  slug: string;
  title: string;
  year: number;
  posterUrl: string;
  titleLocalized?: string;
  overviewLocalized?: string;
};

export function HomeGate() {
  const [authed, setAuthed] = useState<boolean | null>(null);
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
    const auth = localStorage.getItem(AUTH_KEY);
    const isAdmin = auth === PASSWORD_ADMIN;
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(NATIVE_LANGUAGE_KEY) || "" : "";
    const params = new URLSearchParams();
    if (!isAdmin && stored) {
      const lang = nativeLanguageToCode(stored);
      const subtitleSlug = nativeLanguageToSubtitleSlug(stored);
      if (lang) params.set("lang", lang);
      if (subtitleSlug && subtitleSlug !== "english") params.set("subtitleLang", subtitleSlug);
    }
    const query = params.toString();
    const url = query ? `/api/movies?${query}` : "/api/movies";
    fetch(url)
      .then((res) => (res.ok ? res.json() : { movies: [] }))
      .then((data) => setMovies(data?.movies ?? []))
      .catch(() => setMovies([]))
      .finally(() => setMoviesLoading(false));
  }, [authed]);

  const pickLanguage = useCallback((value: string) => {
    localStorage.setItem(AUTH_KEY, PASSWORD_BOLLYWOOD);
    localStorage.setItem(FIRST_NAME_KEY, "Guest");
    localStorage.setItem(NATIVE_LANGUAGE_KEY, value);
    setAuthed(true);
  }, []);

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-12 bg-black px-6">
        <h1 className="text-center text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl">
          Global Cinema
        </h1>
        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:gap-6">
          {LANDING_LANGUAGES.map(({ name, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => pickLanguage(value)}
              className="cursor-pointer rounded-2xl bg-amber-500 px-10 py-6 text-2xl font-medium text-black shadow-lg transition hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-black sm:px-12 sm:py-8 sm:text-3xl"
            >
              {name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const auth = typeof window !== "undefined" ? localStorage.getItem(AUTH_KEY) : null;
  const isAdmin = auth === PASSWORD_ADMIN;
  const storedNativeLanguage =
    typeof window !== "undefined" ? localStorage.getItem(NATIVE_LANGUAGE_KEY) || "" : "";
  const langCode = nativeLanguageToCode(storedNativeLanguage);
  const ui = getUiStrings(langCode);
  const languageLabel =
    storedNativeLanguage.trim() || (langCode === "en" ? "English" : langCode);

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
        <div className="mx-auto flex max-w-4xl flex-col gap-12">
          {movies.map((movie) => (
            <div
              key={movie.slug}
              className="flex flex-col gap-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 shadow-lg sm:flex-row sm:gap-8 sm:p-8"
            >
              <Link
                href={`/${movie.slug}`}
                className="flex-shrink-0 overflow-hidden rounded-xl bg-zinc-800 shadow-md sm:w-56"
              >
                <div className="aspect-[2/3] w-full sm:w-56">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={movie.posterUrl}
                    alt={movie.titleLocalized || movie.title}
                    className="h-full w-full object-cover transition duration-200 hover:scale-[1.03]"
                  />
                </div>
              </Link>
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-3 sm:gap-4">
                <h2 className="text-xl font-semibold leading-tight text-white sm:text-2xl md:text-3xl">
                  {movie.titleLocalized || movie.title}
                </h2>
                {(movie.titleLocalized || movie.title) !== movie.title && (
                  <p className="text-base text-zinc-500 sm:text-lg">
                    {movie.title}
                  </p>
                )}
                <p className="text-sm text-zinc-500">{movie.year}</p>
                {movie.overviewLocalized && (
                  <p className="line-clamp-5 text-base leading-relaxed text-zinc-300 sm:text-lg sm:leading-8">
                    {movie.overviewLocalized}
                  </p>
                )}
                <Link
                  href={`/${movie.slug}`}
                  className="mt-3 inline-flex cursor-pointer items-center justify-center rounded-xl bg-amber-500 px-6 py-4 text-base font-medium text-black shadow-md transition hover:bg-amber-400 sm:mt-4 sm:w-fit sm:px-8 sm:py-4 sm:text-lg"
                >
                  {ui.watchWithSubtitles(languageLabel)}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
