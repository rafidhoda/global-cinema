"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MovieOfTheWeek } from "@/components/MovieOfTheWeek";
import { nativeLanguageToCode, nativeLanguageToSubtitleSlug, getUiStrings } from "@/lib/i18n";

const AUTH_KEY = "global-cinema-auth";
const NATIVE_LANGUAGE_KEY = "global-cinema-native-language";
const PASSWORD_ADMIN = "hoda";

type Props = {
  movieSlug: string;
  videoUrl: string;
  subtitleUrl?: string;
  englishSrtUrl?: string;
  headline: string;
  sneakPeekStartSeconds?: number;
  sneakPeekEndSeconds?: number;
  sneakPeekCtaSeekToSeconds?: number;
};

export function MoviePageClient({
  movieSlug,
  videoUrl,
  subtitleUrl,
  englishSrtUrl,
  headline,
  sneakPeekStartSeconds,
  sneakPeekEndSeconds,
  sneakPeekCtaSeekToSeconds,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userNativeLanguageSlug, setUserNativeLanguageSlug] = useState<string | null>(null);
  const [backLabel, setBackLabel] = useState("Back to movies");
  const [watchButtonLabel, setWatchButtonLabel] = useState("Watch video");
  const [loadingMovieMessage, setLoadingMovieMessage] = useState("Loading movie… get the popcorn!");
  const [posterUrl, setPosterUrl] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    const auth = localStorage.getItem(AUTH_KEY);
    const admin = auth === PASSWORD_ADMIN;
    setIsAdmin(admin);
    const stored = localStorage.getItem(NATIVE_LANGUAGE_KEY) || "";
    const langCode = nativeLanguageToCode(stored);
    const ui = getUiStrings(langCode);
    setWatchButtonLabel(
      typeof sneakPeekCtaSeekToSeconds === "number" ? ui.watchVideo : ui.letsGo
    );
    setLoadingMovieMessage(ui.loadingMovie);
    if (admin) {
      setBackLabel("Back to movies");
      setUserNativeLanguageSlug(null);
    } else {
      setUserNativeLanguageSlug(nativeLanguageToSubtitleSlug(stored));
      setBackLabel(ui.backToMovies);
    }
  }, [mounted, sneakPeekCtaSeekToSeconds]);

  useEffect(() => {
    if (!mounted || !movieSlug) return;
    fetch("/api/movies")
      .then((res) => (res.ok ? res.json() : { movies: [] }))
      .then((data) => {
        const movie = (data?.movies ?? []).find((m: { slug: string }) => m.slug === movieSlug);
        if (movie?.posterUrl) setPosterUrl(movie.posterUrl);
      })
      .catch(() => {});
  }, [mounted, movieSlug]);

  return (
    <div className="fixed inset-0 z-0 bg-black">
      <Link
        href="/"
        className="absolute left-4 top-4 z-30 cursor-pointer rounded-lg bg-black/50 px-3 py-2 text-sm text-white backdrop-blur-sm transition hover:bg-black/70 hover:text-white"
      >
        ← {backLabel}
      </Link>
      <MovieOfTheWeek
        movieSlug={movieSlug}
        videoUrl={videoUrl}
        subtitleUrl={subtitleUrl}
        englishSrtUrl={englishSrtUrl}
        headline={headline}
        isAdmin={isAdmin}
        userNativeLanguageSlug={userNativeLanguageSlug}
        posterUrl={posterUrl ?? undefined}
        sneakPeekStartSeconds={sneakPeekStartSeconds}
        sneakPeekEndSeconds={sneakPeekEndSeconds}
        sneakPeekCtaSeekToSeconds={sneakPeekCtaSeekToSeconds}
        letsGoLabel={watchButtonLabel}
        loadingMovieMessage={loadingMovieMessage}
      />
    </div>
  );
}
