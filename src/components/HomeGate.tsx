"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { nativeLanguageToCode, nativeLanguageToSubtitleSlug, getUiStrings } from "@/lib/i18n";

const AUTH_KEY = "global-cinema-auth";
const FIRST_NAME_KEY = "global-cinema-first-name";
const NATIVE_LANGUAGE_KEY = "global-cinema-native-language";
const PASSWORD_ADMIN = "hoda";
const PASSWORD_BOLLYWOOD = "bollywood";

type OnboardingStep = "password" | "firstName" | "nativeLanguage";

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
  const [step, setStep] = useState<OnboardingStep>("password");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState("");
  const [error, setError] = useState("");
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

  const submitPassword = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      const p = password.trim();
      if (p === PASSWORD_ADMIN) {
        localStorage.setItem(AUTH_KEY, PASSWORD_ADMIN);
        setAuthed(true);
        setPassword("");
      } else if (p === PASSWORD_BOLLYWOOD) {
        setStep("firstName");
        setPassword("");
      } else {
        setError("Wrong password");
      }
    },
    [password]
  );

  const submitFirstName = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      const name = firstName.trim();
      if (name) {
        setStep("nativeLanguage");
      } else {
        setError("Please enter your first name");
      }
    },
    [firstName]
  );

  const submitNativeLanguage = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      const lang = nativeLanguage.trim();
      const name = firstName.trim();
      if (lang) {
        localStorage.setItem(AUTH_KEY, PASSWORD_BOLLYWOOD);
        localStorage.setItem(FIRST_NAME_KEY, name);
        localStorage.setItem(NATIVE_LANGUAGE_KEY, lang);
        setAuthed(true);
        // Save to Supabase (fire-and-forget)
        fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ first_name: name, native_language: lang }),
        }).catch(() => {});
      } else {
        setError("Please enter your native language");
      }
    },
    [nativeLanguage, firstName]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(FIRST_NAME_KEY);
    localStorage.removeItem(NATIVE_LANGUAGE_KEY);
    setAuthed(false);
    setStep("password");
  }, []);

  if (authed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-white" />
      </div>
    );
  }

  if (!authed) {
    const renderForm = () => {
      const inputClass =
        "min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-6 py-5 text-lg text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 sm:px-8 sm:py-6 sm:text-xl";
      const btnClass =
        "cursor-pointer rounded-xl bg-amber-500 px-5 py-5 text-2xl transition hover:bg-amber-400 sm:px-6 sm:py-6 sm:text-3xl";

      if (step === "password") {
        return (
          <form
            onSubmit={submitPassword}
            className="flex w-full max-w-2xl flex-shrink-0 items-stretch gap-2 sm:gap-3"
          >
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="What is the secret password?"
              className={inputClass}
              autoFocus
            />
            <button type="submit" className={btnClass} title="Enter" aria-label="Enter">
              🍿
            </button>
          </form>
        );
      }
      if (step === "firstName") {
        return (
          <div className="flex w-full max-w-2xl flex-col items-stretch gap-4">
            <p className="text-center text-lg text-white sm:text-xl">
              What is your first name?
            </p>
            <form
              onSubmit={submitFirstName}
              className="flex flex-shrink-0 items-stretch gap-2 sm:gap-3"
            >
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                className={inputClass}
                autoFocus
                autoComplete="given-name"
              />
              <button type="submit" className={btnClass} title="Enter" aria-label="Enter">
                🍿
              </button>
            </form>
          </div>
        );
      }
      return (
        <div className="flex w-full max-w-2xl flex-col items-stretch gap-4">
          <p className="text-center text-lg text-white sm:text-xl">
            What is your native language?
          </p>
          <form
            onSubmit={submitNativeLanguage}
            className="flex flex-shrink-0 items-stretch gap-2 sm:gap-3"
          >
            <input
              type="text"
              value={nativeLanguage}
              onChange={(e) => setNativeLanguage(e.target.value)}
              placeholder="Language"
              className={inputClass}
              autoFocus
              autoComplete="language"
            />
            <button type="submit" className={btnClass} title="Enter" aria-label="Enter">
              🍿
            </button>
          </form>
        </div>
      );
    };

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-black px-4">
        {renderForm()}
        {error && (
          <p className="text-center text-sm text-rose-400">{error}</p>
        )}
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
