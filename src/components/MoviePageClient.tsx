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
  const [watchButtonLabel, setWatchButtonLabel] = useState("Watch");
  const [uploadMovieFileLabel, setUploadMovieFileLabel] = useState("Upload movie file");
  const [requestMovieFileLabel, setRequestMovieFileLabel] = useState("Request movie file");
  const [downloadMovieLabel, setDownloadMovieLabel] = useState("Download movie");
  const [downloadThenUploadLabel, setDownloadThenUploadLabel] = useState("Use the link below to download the movie, then upload it here to watch with subtitles.");
  const [downloadSubtitlesLabel, setDownloadSubtitlesLabel] = useState("Download subtitles");
  const [downloadSrtUrl, setDownloadSrtUrl] = useState<string | null>(null);
  const [loadingMovieMessage, setLoadingMovieMessage] = useState("Loading movie… get the popcorn!");
  const [loadingFileAndSubtitlesMessage, setLoadingFileAndSubtitlesMessage] = useState("Loading your file and syncing subtitles…");
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [tutorialStrings, setTutorialStrings] = useState<{
    tutorialTitle: string;
    tutorialStep1: string;
    tutorialStep2: string;
    tutorialStep3: string;
    tutorialStep4WithLang: (lang: string) => string;
    tutorialNext: string;
    tutorialDownloaded: string;
    tutorialLocateFile: string;
    tutorialSkip: string;
  } | null>(null);
  const [subtitleLanguageLabel, setSubtitleLanguageLabel] = useState<string | null>(null);

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
      typeof sneakPeekCtaSeekToSeconds === "number" ? ui.watch : ui.letsGo
    );
    setUploadMovieFileLabel(ui.uploadMovieFile);
    setRequestMovieFileLabel(ui.requestMovieFile);
    setDownloadMovieLabel(ui.downloadMovie);
    setDownloadThenUploadLabel(ui.downloadThenUpload);
    setDownloadSubtitlesLabel(ui.downloadSubtitles);
    setLoadingMovieMessage(ui.loadingMovie);
    setLoadingFileAndSubtitlesMessage(ui.loadingFileAndSubtitles);
    setTutorialStrings({
      tutorialTitle: ui.tutorialTitle,
      tutorialStep1: ui.tutorialStep1,
      tutorialStep2: ui.tutorialStep2,
      tutorialStep3: ui.tutorialStep3,
      tutorialStep4WithLang: ui.tutorialStep4WithLang,
      tutorialNext: ui.tutorialNext,
      tutorialDownloaded: ui.tutorialDownloaded,
      tutorialLocateFile: ui.tutorialLocateFile,
      tutorialSkip: ui.tutorialSkip,
    });
    if (admin) {
      setBackLabel("Back to movies");
      setUserNativeLanguageSlug(null);
      setSubtitleLanguageLabel("English");
    } else {
      const slug = nativeLanguageToSubtitleSlug(stored);
      setUserNativeLanguageSlug(slug);
      setSubtitleLanguageLabel(
        slug
          ? slug.charAt(0).toUpperCase() + slug.slice(1)
          : "English"
      );
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

  // Resolve download URL: user's native language SRT if available, else English
  useEffect(() => {
    if (!mounted || !movieSlug) return;
    if (!englishSrtUrl) {
      setDownloadSrtUrl(null);
      return;
    }
    fetch(
      `/api/subtitles/movie-of-the-week-list?movieSlug=${encodeURIComponent(movieSlug)}`
    )
      .then((res) => (res.ok ? res.json() : { languages: [] }))
      .then((data) => {
        const languages = data?.languages ?? [];
        const nativeUrl =
          userNativeLanguageSlug &&
          languages.find(
            (l: { slug: string }) => l.slug === userNativeLanguageSlug
          )?.url;
        setDownloadSrtUrl(nativeUrl || englishSrtUrl || null);
      })
      .catch(() => setDownloadSrtUrl(englishSrtUrl));
  }, [mounted, movieSlug, englishSrtUrl, userNativeLanguageSlug]);

  return (
    <div className="fixed inset-0 z-0 bg-black">
      <div className="absolute left-4 right-4 top-4 z-30 flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/"
          className="cursor-pointer rounded-lg bg-black/50 px-3 py-2 text-sm text-white backdrop-blur-sm transition hover:bg-black/70 hover:text-white"
        >
          ← {backLabel}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {movieSlug === "taare-zameen-par-2007" && (
            <a
              href="https://wormhole.app/vbZ1bn#Hv21O3mfIQYMo39TTkzKrQ"
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer rounded-lg bg-black/50 px-3 py-2 text-sm text-white backdrop-blur-sm transition hover:bg-black/70 hover:text-white"
            >
              Wormhole
            </a>
          )}
          {downloadSrtUrl && (
            <a
              href={downloadSrtUrl}
              download="subtitles.srt"
              className="cursor-pointer rounded-lg bg-black/50 px-3 py-2 text-sm text-white backdrop-blur-sm transition hover:bg-black/70 hover:text-white"
            >
              {downloadSubtitlesLabel}
            </a>
          )}
        </div>
      </div>
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
        uploadMovieFileLabel={uploadMovieFileLabel}
        requestMovieFileLabel={requestMovieFileLabel}
        downloadMovieLabel={downloadMovieLabel}
        downloadThenUploadLabel={downloadThenUploadLabel}
        loadingMovieMessage={loadingMovieMessage}
        loadingFileAndSubtitlesMessage={loadingFileAndSubtitlesMessage}
        tutorialStrings={tutorialStrings}
        subtitleLanguageLabel={subtitleLanguageLabel}
      />
    </div>
  );
}
