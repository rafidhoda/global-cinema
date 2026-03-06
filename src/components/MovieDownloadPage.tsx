"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { parseSrt } from "@/lib/srt";
import { SUBTITLE_LANGUAGES, type Movie } from "@/lib/movies";

const CHUNK_SIZE = 150;

type AvailableLang = { label: string; slug: string; url: string; cueCount: number };

export function MovieDownloadPage({
  movieSlug,
  movie,
}: {
  movieSlug: string;
  movie: Movie;
}) {
  const [availableLanguages, setAvailableLanguages] = useState<AvailableLang[]>([]);
  const [expectedCueCount, setExpectedCueCount] = useState<number | null>(null);
  const [creatingLang, setCreatingLang] = useState<string | null>(null);
  const [createProgress, setCreateProgress] = useState({ processed: 0, total: 0, message: "" });
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchExpectedCueCount = useCallback(async () => {
    if (!movie.englishSrtUrl?.trim()) {
      setExpectedCueCount(null);
      return;
    }
    try {
      const res = await fetch(movie.englishSrtUrl);
      if (!res.ok) return;
      const text = await res.text();
      setExpectedCueCount(parseSrt(text).length);
    } catch {
      setExpectedCueCount(null);
    }
  }, [movie.englishSrtUrl]);

  const fetchLanguages = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/subtitles/movie-of-the-week-list?movieSlug=${encodeURIComponent(movieSlug)}`
      );
      if (res.ok) {
        const data = await res.json();
        setAvailableLanguages(data?.languages ?? []);
      }
    } catch {
      setAvailableLanguages([]);
    }
  }, [movieSlug]);

  useEffect(() => {
    fetchLanguages();
  }, [fetchLanguages]);

  useEffect(() => {
    fetchExpectedCueCount();
  }, [fetchExpectedCueCount]);

  const englishFromList = availableLanguages.find(
    (l) => l.slug.toLowerCase() === "english"
  );
  useEffect(() => {
    if (expectedCueCount != null) return;
    if (movie.englishSrtUrl?.trim()) return;
    if (englishFromList?.cueCount != null) {
      setExpectedCueCount(englishFromList.cueCount);
    }
  }, [englishFromList?.cueCount, movie.englishSrtUrl, expectedCueCount]);

  const hasEnglishFromConfig = Boolean(movie.englishSrtUrl?.trim());
  const effectiveExpectedCueCount =
    expectedCueCount ?? englishFromList?.cueCount ?? null;
  const completeLanguages = availableLanguages.filter(
    (l) =>
      effectiveExpectedCueCount != null && l.cueCount >= effectiveExpectedCueCount
  );
  const downloadLanguages = (() => {
    const englishEntry = hasEnglishFromConfig
      ? {
          label: "English",
          slug: "english",
          url: movie.englishSrtUrl!,
          cueCount: expectedCueCount ?? 0,
        }
      : englishFromList
        ? {
            label: "English",
            slug: "english",
            url: englishFromList.url,
            cueCount: englishFromList.cueCount,
          }
        : null;
    const others = completeLanguages.filter(
      (l) => l.slug.toLowerCase() !== "english"
    );
    return englishEntry ? [englishEntry, ...others] : others;
  })();
  const hasEnglish = hasEnglishFromConfig || Boolean(englishFromList);

  const translateLanguages = SUBTITLE_LANGUAGES.filter((l) => {
    if (l.slug === "english") return false;
    const available = availableLanguages.find(
      (a) => a.slug.toLowerCase() === l.slug.toLowerCase()
    );
    if (!available) return true;
    return expectedCueCount == null || available.cueCount < expectedCueCount;
  });

  const effectiveEnglishSrtUrl =
    movie.englishSrtUrl?.trim() || englishFromList?.url || "";

  const startTranslate = useCallback(
    async (lang: (typeof SUBTITLE_LANGUAGES)[number]) => {
      if (lang.slug === "english" || !effectiveEnglishSrtUrl) return;

      setCreatingLang(lang.label);
      setCreateError(null);
      setCreateProgress({ processed: 0, total: 0, message: `Translating to ${lang.label}…` });

      try {
        const res = await fetch(effectiveEnglishSrtUrl);
        if (!res.ok) throw new Error("Failed to fetch English subtitles");
        const englishSrt = await res.text();
        const lines = englishSrt.split(/\r?\n/);
        const total = lines.length;

        let startIndex = 0;
        let existingContent = "";

        const existingRes = await fetch(
          `/api/subtitles/upload-movie-of-the-week?movieSlug=${encodeURIComponent(movieSlug)}&language=${encodeURIComponent(lang.label)}`
        );
        if (existingRes.ok) {
          existingContent = await existingRes.text();
          const existingLines = existingContent.split(/\r?\n/).length;
          startIndex = Math.min(existingLines, total);
          if (startIndex > 0) {
            setCreateProgress({
              processed: startIndex,
              total,
              message: `Resuming from ${startIndex}/${total} lines`,
            });
          }
        }

        if (startIndex >= total) {
          setCreatingLang(null);
          setCreateProgress({ processed: total, total, message: `${lang.label} subtitles already complete` });
          fetchLanguages();
          return;
        }

        const remainingLines = lines.slice(startIndex);
        const chunks = Math.max(1, Math.ceil(remainingLines.length / CHUNK_SIZE));
        const buffer: string[] = [];

        for (let i = 0; i < chunks; i += 1) {
          const slice = remainingLines.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          const translateRes = await fetch("/api/translate-batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lines: slice,
              targetLanguage: lang.label,
              modelPreference: "auto",
            }),
          });
          const data = await translateRes.json();
          if (!translateRes.ok || !data?.ok || !Array.isArray(data.lines)) {
            throw new Error(data?.error ?? "Translation failed");
          }

          buffer.push(...data.lines);
          const newPart = buffer.join("\n");
          const fullSrt = existingContent
            ? existingContent.trimEnd() + "\n\n" + newPart
            : newPart;
          const processed = startIndex + Math.min((i + 1) * CHUNK_SIZE, remainingLines.length);

          const uploadRes = await fetch("/api/subtitles/upload-movie-of-the-week", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              movieSlug,
              language: lang.label,
              content: fullSrt,
            }),
          });
          if (!uploadRes.ok) {
            const errData = await uploadRes.json().catch(() => ({}));
            throw new Error(errData?.error ?? "Upload failed");
          }

          setCreateProgress({
            processed,
            total,
            message: `Translated ${processed}/${total} lines`,
          });
          await new Promise((r) => setTimeout(r, 60));
        }

        setCreatingLang(null);
        setCreateProgress((prev) => ({ ...prev, message: `${lang.label} subtitles ready` }));
        fetchLanguages();
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : "Translation failed");
        setCreatingLang(null);
      }
    },
    [movieSlug, effectiveEnglishSrtUrl, fetchLanguages]
  );

  return (
    <div className="min-h-screen bg-black px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="inline-block text-zinc-400 underline transition hover:text-zinc-300"
        >
          ← Back to movies
        </Link>

        <h1 className="mt-8 text-3xl font-semibold text-white sm:text-4xl">
          {movie.title}
        </h1>
        <p className="mt-1 text-zinc-500">{movie.year}</p>

        {/* Download Movie */}
        <section className="mt-10">
          <a
            href={movie.wormholeDownloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-2xl bg-amber-500 px-8 py-6 text-center text-xl font-semibold text-black transition hover:bg-amber-400 sm:py-8 sm:text-2xl"
          >
            Download Movie
          </a>
        </section>

        {/* Download subtitles */}
        <section className="mt-12">
          <h2 className="text-lg font-semibold text-white">Subtitles</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Download subtitles in your language. English first, then other available languages.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {downloadLanguages.length === 0 && hasEnglish && (
              <p className="text-zinc-500">Loading…</p>
            )}
            {downloadLanguages.length === 0 && !hasEnglish && (
              <p className="text-zinc-500">Subtitles coming soon for this movie.</p>
            )}
            {downloadLanguages.map((lang) => (
              <a
                key={lang.slug}
                href={lang.url}
                download={`${movie.title.replace(/\s+/g, "-")}-${lang.slug}.srt`}
                className="inline-flex rounded-xl bg-emerald-600 px-6 py-4 text-base font-medium text-white transition hover:bg-emerald-500 sm:text-lg"
              >
                {lang.label}
              </a>
            ))}
          </div>
        </section>

        {/* Translate subtitles */}
        {hasEnglish && translateLanguages.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-semibold text-white">Translate subtitles</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Click a language to start translation. Progress will appear below.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {translateLanguages.map((lang) => (
                <button
                  key={lang.slug}
                  type="button"
                  onClick={() => startTranslate(lang)}
                  disabled={creatingLang !== null && creatingLang !== lang.label}
                  className="inline-flex rounded-xl bg-zinc-800 px-6 py-4 text-base font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-50 sm:text-lg"
                >
                  {lang.label}
                </button>
              ))}
            </div>
            {creatingLang && (
              <div className="mt-4 rounded-xl bg-zinc-900/80 px-4 py-3 text-sm text-zinc-300">
                <p className="font-medium text-amber-400">{createProgress.message}</p>
                {createProgress.total > 0 && (
                  <p className="mt-1">
                    {createProgress.processed} / {createProgress.total} lines
                  </p>
                )}
              </div>
            )}
            {createError && (
              <p className="mt-4 text-sm text-rose-400">{createError}</p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
