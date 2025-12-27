/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type StatusState = "idle" | "checking" | "ok" | "error";
type Status = {
  state: StatusState;
  message: string;
  detail?: string;
};

type TranslateState = "idle" | "running" | "done" | "error";

type Progress = {
  processed: number;
  total: number;
  chunk: number;
  chunks: number;
  message: string;
};

const CHUNK_SIZE = 60;
const ACTIVE_MODEL = process.env.OPENAI_MODEL || "gpt-4.1";

type TargetLang = {
  code: string;
  label: string;
};

const TARGET_LANGS: TargetLang[] = [
  { code: "en-US", label: "English" },
  { code: "no-NO", label: "Norwegian" },
  { code: "pl-PL", label: "Polish" },
  { code: "hi-IN", label: "Hindi" },
  { code: "hi-Latn", label: "Hindi (English letters)" },
  { code: "ar-SA", label: "Arabic" },
  { code: "ur-PK", label: "Urdu" },
];

export default function ConvertSubtitles() {
  const [status, setStatus] = useState<Status>({
    state: "idle",
    message: "Waiting to check connection…",
  });

  const [sourceText, setSourceText] = useState("");
  const [targetText, setTargetText] = useState("");
  const [translateState, setTranslateState] = useState<TranslateState>("idle");
  const [progress, setProgress] = useState<Progress>({
    processed: 0,
    total: 0,
    chunk: 0,
    chunks: 0,
    message: "",
  });
  const [sourceFileName, setSourceFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [targetLangCode, setTargetLangCode] = useState<string>(TARGET_LANGS[0].code);
  const [downloadReady, setDownloadReady] = useState<boolean>(false);
  const [movieQuery, setMovieQuery] = useState<string>("");
  const [movieInfo, setMovieInfo] = useState<{
    title?: string;
    overview?: string;
    release_date?: string;
    poster_path?: string;
  } | null>(null);
  const [movieLoading, setMovieLoading] = useState<boolean>(false);
  const [movieError, setMovieError] = useState<string>("");
  const [guessLoading, setGuessLoading] = useState<boolean>(false);
  const [showOriginalModal, setShowOriginalModal] = useState<boolean>(false);
  const [showTranslatedModal, setShowTranslatedModal] = useState<boolean>(false);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [videoName, setVideoName] = useState<string>("");
  const [subtitleChoice, setSubtitleChoice] = useState<"none" | "original" | "translated">(
    "none"
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [subtitleOffset, setSubtitleOffset] = useState<number>(0);
  const [originalCues, setOriginalCues] = useState<
    { start: number; end: number; text: string }[]
  >([]);
  const [translatedCues, setTranslatedCues] = useState<
    { start: number; end: number; text: string }[]
  >([]);
  const [activeSubtitle, setActiveSubtitle] = useState<string>("");
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(false);
  const [voiceRate, setVoiceRate] = useState<number>(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [lastSpoken, setLastSpoken] = useState<string>("");

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  // Load available voices for Web Speech
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const loadVoices = () => {
      const list = window.speechSynthesis.getVoices();
      if (!list || list.length === 0) {
        setTimeout(loadVoices, 150);
        return;
      }
      setVoices(list);
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  useEffect(() => {
    setOriginalCues(parseSrt(sourceText));
  }, [sourceText]);

  useEffect(() => {
    setTranslatedCues(parseSrt(targetText));
  }, [targetText]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const interval = setInterval(() => {
      const now = video.currentTime + subtitleOffset;
      let text = "";
      if (subtitleChoice === "original" && originalCues.length > 0) {
        const cue = originalCues.find((c) => now >= c.start && now <= c.end);
        text = cue?.text ?? "";
      } else if (subtitleChoice === "translated" && translatedCues.length > 0) {
        const cue = translatedCues.find((c) => now >= c.start && now <= c.end);
        text = cue?.text ?? "";
      }
      setActiveSubtitle(text);
    }, 500);

    return () => clearInterval(interval);
  }, [subtitleChoice, originalCues, translatedCues, subtitleOffset]);

  // Speak active subtitle when enabled
  useEffect(() => {
    if (!voiceEnabled) {
      setLastSpoken("");
      return;
    }
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const text = activeSubtitle.trim();
    if (!text || text === lastSpoken) return;

    const targetLang = subtitleChoice === "translated" ? targetLangCode : "en-US";
    const langPrefix = targetLang.split("-")[0].toLowerCase();
    const voice =
      voices.find((v) => v.lang.toLowerCase() === targetLang.toLowerCase()) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix)) ||
      voices[0];

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice?.lang || targetLang;
    if (voice) utterance.voice = voice;
    utterance.rate = Math.max(0.6, Math.min(2, voiceRate));
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setLastSpoken(text);
  }, [activeSubtitle, voiceEnabled, voiceRate, targetLangCode, subtitleChoice, voices, lastSpoken]);

  const checkConnection = async () => {
    setStatus({ state: "checking", message: "Contacting OpenAI…" });

    try {
      const response = await fetch("/api/openai-status");
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data?.error ?? "OpenAI connection failed");
      }

      setStatus({
        state: "ok",
        message: "Connected",
        detail: data.model ? `Verified model: ${data.model}` : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reach OpenAI";
      setStatus({
        state: "error",
        message: "Connection issue",
        detail: message,
      });
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const badgeColor = {
    idle: "bg-zinc-700 text-zinc-200",
    checking: "bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/60",
    ok: "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/60",
    error: "bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/60",
  }[status.state];

  const percent = useMemo(() => {
    if (!progress.total) return 0;
    return Math.min(100, Math.round((progress.processed / progress.total) * 100));
  }, [progress.processed, progress.total]);

  const handleTranslateInChunks = async () => {
    const targetLang = TARGET_LANGS.find((t) => t.code === targetLangCode) ?? TARGET_LANGS[0];
    const lines = sourceText.split(/\r?\n/);
    const total = lines.length;

    if (total === 0) {
      console.error("[ui] No source lines to translate");
      setTranslateState("error");
      setProgress((prev) => ({
        ...prev,
        processed: 0,
        total: 0,
        chunk: 0,
        chunks: 0,
        message: "Paste subtitle text on the left before translating.",
      }));
      return;
    }

    const chunks = Math.max(1, Math.ceil(total / CHUNK_SIZE));

    setTranslateState("running");
    setDownloadReady(false);
    setProgress({
      processed: 0,
      total,
      chunk: 0,
      chunks,
      message: `Starting translation to ${targetLang.label} in ${CHUNK_SIZE}-line batches…`,
    });
    setTargetText("");

    const buffer: string[] = [];

    for (let i = 0; i < chunks; i += 1) {
      const slice = lines.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);

      try {
        const response = await fetch("/api/translate-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lines: slice,
            targetLanguage: targetLang.label,
            movieTitle: movieInfo?.title,
            movieYear: movieInfo?.release_date ? movieInfo.release_date.slice(0, 4) : undefined,
            movieOverview: movieInfo?.overview,
          }),
        });
        const data = await response.json();

        if (!response.ok || !data.ok || !Array.isArray(data.lines)) {
          console.error("[ui] Translation API error", {
            status: response.status,
            body: data,
          });
          throw new Error(data?.error ?? "Translation failed");
        }

        buffer.push(...data.lines);
        setTargetText(buffer.join("\n"));

        const processed = Math.min((i + 1) * CHUNK_SIZE, total);
        setProgress({
          processed,
          total,
          chunk: i + 1,
          chunks,
          message: `Translated chunk ${i + 1} of ${chunks} (${processed}/${total} lines)`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to translate chunk.";
        console.error("[ui] Chunk translation failed", { error, chunk: i + 1 });
        setTranslateState("error");
        setProgress((prev) => ({
          ...prev,
          message,
        }));
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    setTranslateState("done");
    setDownloadReady(true);
    setProgress((prev) => ({
      ...prev,
      message: `Completed translation to ${targetLang.label} in ${CHUNK_SIZE}-line batches.`,
    }));
    console.log("[ui] Translation complete", { totalLines: total, chunks });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setSourceText(text);
      setTargetText("");
      setSourceFileName(file.name);
      const guessed = file.name.replace(/\.[^.]+$/, "").replace(/[_\.]/g, " ");
      setMovieQuery(guessed);
      void guessMovie(file.name);
      setProgress({
        processed: 0,
        total: text ? text.split(/\r?\n/).length : 0,
        chunk: 0,
        chunks: 0,
        message: `Loaded ${file.name}`,
      });
    };
    reader.readAsText(file);
  };

  const handleVideoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setVideoName(file.name);
  };

  const parseTime = (value: string) => {
    // "00:01:35,053"
    const [hms, ms] = value.split(",");
    if (!hms || !ms) return 0;
    const [h, m, s] = hms.split(":").map(Number);
    return h * 3600 + m * 60 + s + Number(ms) / 1000;
  };

  const parseSrt = (srt: string) => {
    if (!srt.trim()) return [];
    const blocks = srt.replace(/\r\n/g, "\n").split(/\n\n+/);
    const cues: { start: number; end: number; text: string }[] = [];
    for (const block of blocks) {
      const rawLines = block.split("\n").filter((l) => l.trim().length > 0);
      if (rawLines.length < 2) continue;

      // Find the timing line (can be line 1 if index is present)
      let timingLineIndex = 0;
      if (/^\d+$/.test(rawLines[0]) && rawLines.length >= 2) {
        timingLineIndex = 1;
      }
      const timing = rawLines[timingLineIndex]?.match(
        /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/
      );
      if (!timing) continue;

      const textStartIndex = timingLineIndex + 1;
      const text = rawLines.slice(textStartIndex).join("\n");
      const start = parseTime(timing[1]);
      const end = parseTime(timing[2]);

      cues.push({ start, end, text });
    }
    return cues;
  };

  const handleDownload = () => {
    if (!targetText.trim()) return;
    const blob = new Blob([targetText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const lang = TARGET_LANGS.find((t) => t.code === targetLangCode)?.label || "translated";
    const base = sourceFileName ? sourceFileName.replace(/\.srt$/i, "") : "subtitles";
    link.download = `${base}-${lang}.srt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const fetchMovie = async (query: string) => {
    if (!query.trim()) return;
    setMovieLoading(true);
    setMovieError("");
    try {
      const res = await fetch("/api/tmdb/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.first) {
        setMovieInfo(null);
        console.error("[ui] TMDB search error", { status: res.status, body: data });
        setMovieError(
          data?.error ? `Could not find movie: ${data.error}` : "Could not find movie."
        );
        return;
      }
      setMovieInfo(data.first);
    } catch (error) {
      setMovieInfo(null);
      console.error("[ui] TMDB search exception", { error });
      setMovieError("Movie lookup failed. Try a different title.");
    } finally {
      setMovieLoading(false);
    }
  };

  const guessMovie = async (filename: string) => {
    if (!filename.trim()) return;
    setGuessLoading(true);
    try {
      const res = await fetch("/api/guess-movie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json();
      if (res.ok && data.ok && data.guess?.title) {
        const title = data.guess.title;
        const year = data.guess.year ? ` (${data.guess.year})` : "";
        const combined = `${title}${year}`.trim();
        setMovieQuery(combined);
        await fetchMovie(combined);
      }
    } catch (error) {
      // ignore guess errors silently
    } finally {
      setGuessLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-14">
        <header className="flex flex-col gap-4 text-center sm:text-left">
          <h1 className="text-4xl font-semibold sm:text-5xl">Translate your Subtitles</h1>
          <p className="max-w-3xl text-lg text-zinc-300">
            Upload SRT, choose a language, convert, and download the translated file.
          </p>
        </header>

        <main className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-zinc-100">Video preview</h2>
                <p className="text-sm text-zinc-400">
                  Load a local video to preview with original or translated subtitles while converting.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "video/*";
                    input.onchange = (e) =>
                      handleVideoSelect(e as unknown as React.ChangeEvent<HTMLInputElement>);
                    input.click();
                  }}
                  className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                >
                  Load video
                </button>
                <select
                  value={subtitleChoice}
                  onChange={(e) =>
                    setSubtitleChoice(e.target.value as "none" | "original" | "translated")
                  }
                  className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                >
                  <option value="none">No subtitles</option>
                  <option value="original" disabled={!sourceText.trim()}>
                    Original subtitles
                  </option>
                  <option value="translated" disabled={!targetText.trim()}>
                    Translated subtitles
                  </option>
                </select>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">Offset (s):</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSubtitleOffset((v) => v - 0.5)}
                      className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-100 transition hover:bg-zinc-700"
                    >
                      -0.5
                    </button>
                    <input
                      type="number"
                      step="0.1"
                      value={subtitleOffset}
                      onChange={(e) => setSubtitleOffset(Number(e.target.value))}
                      className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setSubtitleOffset((v) => v + 0.5)}
                      className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-100 transition hover:bg-zinc-700"
                    >
                      +0.5
                    </button>
                  </div>
                  <label className="ml-3 flex items-center gap-2 text-xs text-zinc-400">
                    <input
                      type="checkbox"
                      checked={voiceEnabled}
                      onChange={(e) => setVoiceEnabled(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Read aloud
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-zinc-400">Rate:</span>
                    <input
                      type="range"
                      min={0.6}
                      max={2}
                      step={0.1}
                      value={voiceRate}
                      onChange={(e) => setVoiceRate(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-black">
              {videoUrl ? (
                <div className="relative">
                  <video
                    key={videoUrl}
                    ref={videoRef}
                    className="w-full"
                    controls
                    crossOrigin="anonymous"
                  >
                    <source src={videoUrl} />
                  </video>
                  {subtitleChoice !== "none" && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-4">
                      <div className="w-full max-w-3xl px-4 py-2 text-center text-lg font-semibold leading-7 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                        {activeSubtitle || ""}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-56 items-center justify-center text-sm text-zinc-500">
                  Load a video file to preview with subtitles.
                </div>
              )}
            </div>
            {videoName && <div className="text-xs text-zinc-500">Loaded video: {videoName}</div>}
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6">
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-xl bg-emerald-600 px-4 py-4 text-lg font-semibold text-emerald-50 transition hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              >
                Original Subtitles (.srt)
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".srt,text/plain"
                className="hidden"
                onChange={handleFileSelect}
              />
              <div className="flex flex-wrap items-center justify-between text-sm text-zinc-400">
                <span>{sourceFileName ? `Loaded: ${sourceFileName}` : "No file selected yet"}</span>
                <span>{progress.total > 0 ? `${progress.total} lines detected` : ""}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <button
                  type="button"
                  onClick={() => setShowOriginalModal(true)}
                  disabled={!sourceText.trim()}
                  className="rounded bg-zinc-800 px-3 py-1 text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  View original
                </button>
                <button
                  type="button"
                  onClick={() => setShowTranslatedModal(true)}
                  disabled={!targetText.trim() && translateState !== "running"}
                  className="rounded bg-zinc-800 px-3 py-1 text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  View translation
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm text-zinc-400">Movie title (optional)</label>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={movieQuery}
                    onChange={(e) => setMovieQuery(e.target.value)}
                    className="flex-1 min-w-[200px] rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
                    placeholder="Guess or type the movie title…"
                  />
                  <button
                    type="button"
                    onClick={() => fetchMovie(movieQuery)}
                    className="rounded bg-zinc-800 px-3 py-2 text-sm text-zinc-100 transition hover:bg-zinc-700"
                    disabled={movieLoading || !movieQuery.trim()}
                  >
                    {movieLoading ? "Searching…" : "Find movie"}
                  </button>
                  {guessLoading && (
                    <span className="text-xs text-zinc-400">Guessing title…</span>
                  )}
                </div>
                {movieError && <div className="text-sm text-rose-300">{movieError}</div>}
                {movieInfo && (
                  <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/80 p-3">
                    {movieInfo.poster_path && (
                      <img
                        src={`https://image.tmdb.org/t/p/w185${movieInfo.poster_path}`}
                        alt={movieInfo.title}
                        className="h-24 w-16 rounded object-cover"
                      />
                    )}
                    <div className="space-y-1 text-sm">
                      <div className="font-semibold text-zinc-100">
                        {movieInfo.title}
                        {movieInfo.release_date ? ` (${movieInfo.release_date.slice(0, 4)})` : ""}
                      </div>
                      <div className="text-zinc-400 line-clamp-3">
                        {movieInfo.overview || "No overview available."}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-400">Target language:</span>
                <select
                  value={targetLangCode}
                  onChange={(e) => setTargetLangCode(e.target.value)}
                  className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                >
                  {TARGET_LANGS.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleTranslateInChunks}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={translateState === "running" || !sourceText.trim()}
              >
                {translateState === "running" ? "Converting…" : "Convert"}
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm text-zinc-400">
                <span>Progress</span>
                <span>
                  {progress.total > 0 ? `${progress.processed}/${progress.total} lines` : "Waiting to start"}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full bg-emerald-500 transition-[width]" style={{ width: `${percent}%` }} />
              </div>
              {progress.message && <div className="text-sm text-zinc-300">{progress.message}</div>}
              {translateState === "done" && (
                <div className="text-sm font-medium text-emerald-300">
                  Translation completed. Download your .srt below.
                </div>
              )}
              {translateState === "error" && (
                <div className="text-sm font-medium text-rose-300">
                  Translation failed. Check the file and try again.
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm text-zinc-400">
                <span>Download</span>
              </div>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!downloadReady}
                className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {downloadReady ? "Download translated .srt" : "Translation not ready"}
              </button>
            </div>
          </div>
        </main>

        {showOriginalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="max-h-[80vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <h3 className="text-lg font-semibold text-zinc-100">Original subtitles</h3>
                <button
                  type="button"
                  onClick={() => setShowOriginalModal(false)}
                  className="rounded bg-zinc-800 px-3 py-1 text-sm text-zinc-100 transition hover:bg-zinc-700"
                >
                  Close
                </button>
              </div>
              <div className="max-h-[70vh] overflow-auto px-4 py-3 font-mono text-sm text-zinc-200 whitespace-pre-wrap">
                {sourceText || "No content loaded."}
              </div>
            </div>
          </div>
        )}

        {showTranslatedModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="max-h-[80vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <h3 className="text-lg font-semibold text-zinc-100">Translated subtitles</h3>
                <button
                  type="button"
                  onClick={() => setShowTranslatedModal(false)}
                  className="rounded bg-zinc-800 px-3 py-1 text-sm text-zinc-100 transition hover:bg-zinc-700"
                >
                  Close
                </button>
              </div>
              <div className="max-h-[70vh] overflow-auto px-4 py-3 font-mono text-sm text-zinc-200 whitespace-pre-wrap">
                {targetText ||
                  (translateState === "running"
                    ? "Translating… content will appear as it completes."
                    : "No translated content yet.")}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

