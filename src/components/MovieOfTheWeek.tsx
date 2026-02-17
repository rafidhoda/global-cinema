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
] as const;

/** Treat these as complete even if cue count disagrees (e.g. list API cache). */
const MANUALLY_COMPLETE_SLUGS = new Set(["polish", "norwegian"]);

type Props = {
  videoUrl: string;
  subtitleUrl?: string;
  englishSrtUrl?: string;
  headline?: string;
};

export function MovieOfTheWeek({
  videoUrl,
  subtitleUrl,
  englishSrtUrl,
  headline = "Taare Zameen Par (2007)",
}: Props) {
  const hasVideo = Boolean(videoUrl?.trim());
  const videoRef = useRef<HTMLVideoElement>(null);
  const createdTrackRef = useRef<TextTrack | null>(null);
  const createdCuesCountRef = useRef(0);

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
    try {
      const res = await fetch("/api/subtitles/movie-of-the-week-list");
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
  }, []);

  useEffect(() => {
    if (createState === "done") {
      fetchAvailableLanguages();
    }
  }, [createState]);

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
        `/api/subtitles/upload-movie-of-the-week?language=${encodeURIComponent(lang.label)}`
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
          body: JSON.stringify({ language: lang.label, content: fullSrt }),
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
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="mb-6 text-center text-2xl font-semibold text-white sm:text-3xl">{headline}</h1>

      <div className="overflow-hidden rounded-lg bg-black">
        <video
          ref={videoRef}
          controls
          preload="metadata"
          className="w-full object-contain"
          playsInline
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
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
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

      {createState === "running" && (
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm text-zinc-400">
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
        <p className="mt-2 text-sm text-rose-400">{createError}</p>
      )}

      {createState === "done" && createdLangUrl && (
        <p className="mt-2 text-sm text-emerald-400">
          Subtitles saved. You can use the same language next time from the track menu or reload to see the new track.
        </p>
      )}
    </div>
  );
}
