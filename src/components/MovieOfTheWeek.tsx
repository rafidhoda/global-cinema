"use client";

import { useEffect, useRef, useState } from "react";
import { parseSrt } from "@/lib/srt";

type AvailableLang = { label: string; slug: string; url: string; cueCount?: number };

const CHUNK_SIZE = 150;

const CREATE_LANGS = [
  { label: "Norwegian", slug: "norwegian" },
  { label: "Polish", slug: "polish" },
  { label: "French", slug: "french" },
  { label: "German", slug: "german" },
  { label: "Lithuanian", slug: "lithuanian" },
  { label: "Danish", slug: "danish" },
  { label: "Swedish", slug: "swedish" },
  { label: "Russian", slug: "russian" },
  { label: "Bengali", slug: "bengali" },
] as const;

/** Treat these as complete even if cue count disagrees (e.g. list API cache). */
const MANUALLY_COMPLETE_SLUGS = new Set(["polish", "norwegian"]);

type Props = {
  movieSlug: string;
  videoUrl: string;
  subtitleUrl?: string;
  englishSrtUrl?: string;
  headline?: string;
  /** Poster/thumbnail image for the video before playback. */
  posterUrl?: string;
  /** Sneak peek: show CTA when playback is within [start, end] seconds. */
  sneakPeekStartSeconds?: number;
  sneakPeekEndSeconds?: number;
  /** When user clicks "Let's go!", seek video to this time (seconds). If unset, button links to /. */
  sneakPeekCtaSeekToSeconds?: number;
  /** CTA label during sneak peek (e.g. "Let's go!" in user's language). */
  letsGoLabel?: string;
  /** Shown over the video while it loads (e.g. "Loading movie… get the popcorn!" in user's language). */
  loadingMovieMessage?: string;
  /** Admin sees subtitle toggles and Create Subtitles; when false, subtitles auto-set to user's native language. */
  isAdmin?: boolean;
  /** When isAdmin is false, auto-select this subtitle slug (e.g. "polish"). */
  userNativeLanguageSlug?: string | null;
};

export function MovieOfTheWeek({
  movieSlug,
  videoUrl,
  subtitleUrl,
  englishSrtUrl,
  headline = "Taare Zameen Par (2007)",
  posterUrl,
  sneakPeekStartSeconds,
  sneakPeekEndSeconds,
  sneakPeekCtaSeekToSeconds,
  letsGoLabel,
  loadingMovieMessage,
  isAdmin = true,
  userNativeLanguageSlug = null,
}: Props) {
  const hasVideo = Boolean(videoUrl?.trim());
  const videoRef = useRef<HTMLVideoElement>(null);
  const createdTrackRef = useRef<TextTrack | null>(null);
  const createdCuesCountRef = useRef(0);

  const [videoReady, setVideoReady] = useState(false);
  const [subtitlesOn, setSubtitlesOn] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createState, setCreateState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [creatingLang, setCreatingLang] = useState<string | null>(null);
  const [createProgress, setCreateProgress] = useState({ processed: 0, total: 0, message: "" });
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdLangUrl, setCreatedLangUrl] = useState<string | null>(null);
  const [availableLanguages, setAvailableLanguages] = useState<AvailableLang[]>([]);
  const [activeSubtitle, setActiveSubtitle] = useState<"en" | string | null>(null);
  const [expectedCueCount, setExpectedCueCount] = useState<number | null>(null);
  const hasAutoSelectedRef = useRef(false);
  const [sneakPeekButtonRevealed, setSneakPeekButtonRevealed] = useState(false);
  const sneakPeekRevealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasClickedWatch, setHasClickedWatch] = useState(false);
  const hasAppliedInitialPositionRef = useRef(false);

  const hasWatchButton = typeof sneakPeekCtaSeekToSeconds === "number";

  useEffect(() => {
    if (!englishSrtUrl?.trim()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(englishSrtUrl);
        if (!res.ok || cancelled) return;
        const text = await res.text();
        if (cancelled) return;
        setExpectedCueCount(parseSrt(text).length);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [englishSrtUrl]);

  const fetchAvailableLanguages = async () => {
    if (!movieSlug) return;
    try {
      const res = await fetch(
        `/api/subtitles/movie-of-the-week-list?movieSlug=${encodeURIComponent(movieSlug)}`
      );
      if (res.ok) {
        const data = await res.json();
        setAvailableLanguages(data?.languages ?? []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchAvailableLanguages();
  }, [movieSlug]);

  useEffect(() => {
    if (createState === "done") {
      fetchAvailableLanguages();
    }
  }, [createState]);

  // For non-admin (bollywood): auto-select user's native language track once available
  useEffect(() => {
    if (isAdmin || !userNativeLanguageSlug || availableLanguages.length === 0) return;
    if (hasAutoSelectedRef.current) return;
    const match = availableLanguages.find((l) => l.slug === userNativeLanguageSlug);
    if (match) {
      hasAutoSelectedRef.current = true;
      const video = videoRef.current;
      if (!video?.textTracks?.length) return;
      requestAnimationFrame(() => {
        const list = Array.from(videoRef.current?.textTracks ?? []);
        list.forEach((t) => { t.mode = "disabled"; });
        const matches = list.filter((t) => t.label === match.label);
        const trackToShow = matches.length > 0 ? matches[matches.length - 1] : null;
        if (trackToShow) {
          trackToShow.mode = "showing";
          setActiveSubtitle(match.slug);
          setSubtitlesOn(true);
        }
      });
    } else if (subtitleUrl) {
      hasAutoSelectedRef.current = true;
      requestAnimationFrame(() => {
        const list = Array.from(videoRef.current?.textTracks ?? []);
        list.forEach((t) => { t.mode = "disabled"; });
        if (list[0]) {
          list[0].mode = "showing";
          setActiveSubtitle("en");
          setSubtitlesOn(true);
        }
      });
    }
  }, [isAdmin, userNativeLanguageSlug, availableLanguages, subtitleUrl]);

  // Reveal Watch button after a short delay
  useEffect(() => {
    if (!hasWatchButton || !letsGoLabel) return;
    if (sneakPeekRevealTimeoutRef.current) clearTimeout(sneakPeekRevealTimeoutRef.current);
    sneakPeekRevealTimeoutRef.current = setTimeout(() => {
      setSneakPeekButtonRevealed(true);
      sneakPeekRevealTimeoutRef.current = null;
    }, 500);
    return () => {
      if (sneakPeekRevealTimeoutRef.current) {
        clearTimeout(sneakPeekRevealTimeoutRef.current);
        sneakPeekRevealTimeoutRef.current = null;
      }
    };
  }, [hasWatchButton, letsGoLabel]);

  // On load: seek to 2:01 (or configured time) and pause; user clicks "Watch video" to resume
  useEffect(() => {
    const video = videoRef.current;
    if (
      !video ||
      !videoReady ||
      !hasWatchButton ||
      hasAppliedInitialPositionRef.current
    )
      return;
    hasAppliedInitialPositionRef.current = true;
    video.currentTime = sneakPeekCtaSeekToSeconds!;
  }, [videoReady, hasWatchButton, sneakPeekCtaSeekToSeconds]);

  const onWatchButtonClick = () => {
    setHasClickedWatch(true);
    videoRef.current?.play().catch(() => {});
  };

  const toggleSubtitles = () => {
    const video = videoRef.current;
    if (!video?.textTracks?.length) return;
    const track = video.textTracks[0];
    if (track.mode === "showing") {
      track.mode = "disabled";
      setSubtitlesOn(false);
      setActiveSubtitle(null);
    } else {
      for (const t of video.textTracks) t.mode = "disabled";
      track.mode = "showing";
      setSubtitlesOn(true);
      setActiveSubtitle("en");
    }
  };

  const selectSubtitleLang = (lang: AvailableLang) => {
    const video = videoRef.current;
    if (!video?.textTracks) return;
    const isCurrentlyActive = activeSubtitle === lang.slug;
    if (isCurrentlyActive) {
      const matches = Array.from(video.textTracks).filter((t) => t.label === lang.label);
      matches.forEach((t) => { t.mode = "disabled"; });
      setActiveSubtitle(null);
    } else {
      const list = Array.from(video.textTracks);
      list.forEach((t) => { t.mode = "disabled"; });
      // Explicitly ensure English (index 0) is off when selecting another language
      if (list.length > 0 && list[0].label === "English") list[0].mode = "disabled";
      // Prefer last matching track (DOM <track> is usually the full file; programmatic can be partial)
      const matches = list.filter((t) => t.label === lang.label);
      const trackToShow = matches.length > 0 ? matches[matches.length - 1] : null;
      if (trackToShow) {
        trackToShow.mode = "showing";
        // Safari/iOS sometimes only updates subtitle display after a tick
        if (typeof requestAnimationFrame !== "undefined") {
          requestAnimationFrame(() => {
            list.forEach((t) => { t.mode = "disabled"; });
            if (list[0].label === "English") list[0].mode = "disabled";
            trackToShow.mode = "showing";
          });
        }
      }
      setActiveSubtitle(lang.slug);
    }
  };

  const handleRightSideLangClick = (lang: AvailableLang) => {
    const isComplete =
      expectedCueCount != null &&
      lang.cueCount != null &&
      lang.cueCount >= expectedCueCount;
    if (isComplete) {
      selectSubtitleLang(lang);
      return;
    }
    const createLang = CREATE_LANGS.find((l) => l.slug === lang.slug);
    if (createLang) {
      startCreateSubtitles(createLang);
    } else {
      selectSubtitleLang(lang);
    }
  };

  const startCreateSubtitles = async (lang: (typeof CREATE_LANGS)[number]) => {
    if (!englishSrtUrl?.trim() || !videoRef.current) return;

    setCreateOpen(false);
    setCreateState("running");
    setCreatingLang(lang.label);
    setCreateError(null);
    setCreatedLangUrl(null);
    createdCuesCountRef.current = 0;

    if (createdTrackRef.current) {
      createdTrackRef.current.mode = "disabled";
      createdTrackRef.current = null;
    }

    const track = videoRef.current.addTextTrack("subtitles", lang.label, lang.slug);
    track.mode = "showing";
    createdTrackRef.current = track;

    try {
      const res = await fetch(englishSrtUrl);
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
          const existingCues = parseSrt(existingContent);
          for (const cue of existingCues) {
            if (typeof window !== "undefined" && window.VTTCue) {
              track.addCue(new window.VTTCue(cue.start, cue.end, cue.text));
            }
          }
          createdCuesCountRef.current = existingCues.length;
          setCreateProgress({
            processed: startIndex,
            total,
            message: `Resuming from ${startIndex}/${total} lines — you can watch now`,
          });
        }
      }

      if (startIndex >= total) {
        setCreateState("done");
        setCreatingLang(null);
        setActiveSubtitle(lang.slug);
        setCreateProgress({ processed: total, total, message: `${lang.label} subtitles already complete` });
        fetchAvailableLanguages();
        return;
      }

      const remainingLines = lines.slice(startIndex);
      const chunks = Math.max(1, Math.ceil(remainingLines.length / CHUNK_SIZE));

      if (startIndex === 0) {
        setCreateProgress({ processed: 0, total, message: `Translating to ${lang.label}…` });
      }

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
        const uploadData = await uploadRes.json();
        if (uploadRes.ok && uploadData?.ok && uploadData?.url) {
          setCreatedLangUrl(uploadData.url);
        }

        const cues = parseSrt(fullSrt);
        for (let j = createdCuesCountRef.current; j < cues.length; j++) {
          const cue = cues[j];
          if (typeof window !== "undefined" && window.VTTCue) {
            track.addCue(new window.VTTCue(cue.start, cue.end, cue.text));
          }
        }
        createdCuesCountRef.current = cues.length;

        setCreateProgress({
          processed,
          total,
          message: `Translated ${processed}/${total} lines — you can watch now`,
        });

        await new Promise((r) => setTimeout(r, 60));
      }

      setCreateState("done");
      setCreatingLang(null);
      setActiveSubtitle(lang.slug);
      setCreateProgress((prev) => ({ ...prev, message: `${lang.label} subtitles ready` }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Translation failed";
      setCreateError(message);
      setCreateState("error");
      setCreatingLang(null);
    }
  };

  if (!hasVideo) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-center text-zinc-500">
          Set <code className="rounded bg-zinc-800 px-2 py-1 text-zinc-400">NEXT_PUBLIC_MOVIE_OF_WEEK_VIDEO_URL</code> in .env.local to your Supabase file URL (click &quot;Get URL&quot; on the file in Storage).
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      <div className="relative flex-1 min-h-0">
        {!videoReady && loadingMovieMessage && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-zinc-950">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-3 w-3 animate-bounce rounded-full bg-amber-500"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <p className="text-center text-lg text-zinc-300 sm:text-xl">
              {loadingMovieMessage}
            </p>
          </div>
        )}
        <video
          ref={videoRef}
          controls
          preload="metadata"
          poster={videoReady ? posterUrl : undefined}
          className="netflix-player absolute inset-0 h-full w-full object-cover"
          playsInline
          onLoadedData={() => setVideoReady(true)}
        >
          <source src={videoUrl} type="video/mp4" />
          {subtitleUrl && (
            <track
              kind="subtitles"
              src={subtitleUrl}
              srcLang="en"
              label="English"
              default={false}
            />
          )}
          {availableLanguages.map((lang) => (
            <track
              key={lang.slug}
              kind="subtitles"
              src={`/api/subtitles/vtt?url=${encodeURIComponent(lang.url)}`}
              srcLang={lang.slug}
              label={lang.label}
              default={false}
            />
          ))}
        </video>
        {hasWatchButton && !hasClickedWatch && letsGoLabel && (
          <div
            className={`absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-500 ${
              sneakPeekButtonRevealed ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <button
              type="button"
              onClick={onWatchButtonClick}
              className="cursor-pointer rounded-xl border-0 bg-white px-8 py-4 text-4xl font-bold text-black shadow-lg outline-none transition hover:scale-105 hover:bg-zinc-100 sm:text-5xl md:text-6xl"
            >
              {letsGoLabel}
            </button>
          </div>
        )}
      </div>

      {isAdmin && (
      <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-t from-black/90 via-black/70 to-transparent px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          {subtitleUrl && (
            <button
              type="button"
              onClick={toggleSubtitles}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeSubtitle === "en"
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              English {activeSubtitle === "en" ? "✓" : ""}
            </button>
          )}
          {availableLanguages.map((lang) => {
            const isComplete =
              MANUALLY_COMPLETE_SLUGS.has(lang.slug) ||
              (expectedCueCount != null &&
                lang.cueCount != null &&
                lang.cueCount >= expectedCueCount);
            const progressPct =
              !isComplete &&
              expectedCueCount != null &&
              expectedCueCount > 0 &&
              lang.cueCount != null
                ? Math.min(100, (lang.cueCount / expectedCueCount) * 100)
                : null;
            const isSelected = activeSubtitle === lang.slug;
            return (
              <button
                key={lang.slug}
                type="button"
                onClick={() => handleRightSideLangClick(lang)}
                className={`relative overflow-hidden rounded-lg px-4 py-2 text-sm font-medium transition hover:opacity-90 ${
                  isSelected
                    ? isComplete
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-800"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
                style={
                  isSelected && progressPct != null
                    ? {
                        background: `linear-gradient(to right, #059669 0%, #059669 ${progressPct}%, #27272a ${progressPct}%, #27272a 100%)`,
                        color: "white",
                      }
                    : undefined
                }
              >
                <span className="relative z-10">
                  {lang.label}
                  {!isComplete && " (in progress)"}
                  {isComplete && isSelected ? " ✓" : ""}
                </span>
              </button>
            );
          })}
        </div>
        {englishSrtUrl && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setCreateOpen((o) => !o)}
              disabled={createState === "running"}
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-60"
            >
              {createState === "running" && creatingLang
                ? `Creating ${creatingLang} Subtitles`
                : "Create Subtitles"}
            </button>
            {createOpen && (
              <div className="absolute right-0 top-full z-10 mt-2 flex flex-col rounded-lg border border-zinc-700 bg-zinc-900 py-2 shadow-xl">
                {CREATE_LANGS.map((lang) => (
                  <button
                    key={lang.slug}
                    type="button"
                    onClick={() => startCreateSubtitles(lang)}
                    className="px-4 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {createState === "running" && (
        <div className="absolute bottom-20 left-4 right-4 z-10 space-y-2 rounded-lg bg-black/80 px-4 py-3 backdrop-blur-sm">
          <div className="flex justify-between text-sm text-zinc-300">
            <span>{createProgress.message}</span>
            <span>
              {createProgress.total > 0
                ? `${createProgress.processed}/${createProgress.total}`
                : ""}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-emerald-500 transition-[width]"
              style={{
                width:
                  createProgress.total > 0
                    ? `${(createProgress.processed / createProgress.total) * 100}%`
                    : "0%",
              }}
            />
          </div>
        </div>
      )}

      {createError && (
        <p className="absolute bottom-24 left-4 right-4 z-10 text-sm text-rose-400">
          {createError}
        </p>
      )}

      {createState === "done" && createdLangUrl && (
        <p className="absolute bottom-24 left-4 right-4 z-10 text-sm text-emerald-400">
          Subtitles saved. You can use the same language next time from the track menu or reload to see the new track.
        </p>
      )}
    </div>
  );
}
