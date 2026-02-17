"use client";

import { useCallback, useRef, useState } from "react";

const CHUNK_SIZE = 150;

const TARGET_LANGS = [
  { code: "pl-PL", label: "Polish" },
  { code: "no-NO", label: "Norwegian" },
  { code: "lt-LT", label: "Lithuanian" },
  { code: "hi-IN", label: "Hindi" },
] as const;

type TranslateState = "idle" | "running" | "done" | "error";

type Progress = {
  processed: number;
  total: number;
  chunk: number;
  chunks: number;
  message: string;
};

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export default function TranslateSrtPage() {
  const [sourceText, setSourceText] = useState("");
  const [targetText, setTargetText] = useState("");
  const [sourceFileName, setSourceFileName] = useState("");
  const [targetLangCode, setTargetLangCode] = useState<string>(TARGET_LANGS[0].code);
  const [translateState, setTranslateState] = useState<TranslateState>("idle");
  const [progress, setProgress] = useState<Progress>({
    processed: 0,
    total: 0,
    chunk: 0,
    chunks: 0,
    message: "",
  });
  const [error, setError] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const percent = progress.total > 0 ? Math.min(100, Math.round((progress.processed / progress.total) * 100)) : 0;

  const loadFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith(".srt") && !file.type.includes("text")) {
      setError("Please drop an SRT file (.srt)");
      return;
    }
    readFileAsText(file).then((text) => {
      setSourceText(text);
      setTargetText("");
      setSourceFileName(file.name);
      setTranslateState("idle");
      setError("");
      const lineCount = text ? text.split(/\r?\n/).length : 0;
      setProgress({
        processed: 0,
        total: lineCount,
        chunk: 0,
        chunks: 0,
        message: lineCount > 0 ? `Loaded ${file.name} (${lineCount} lines)` : `Loaded ${file.name}`,
      });
    }).catch(() => setError("Could not read file"));
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) loadFile(file);
    event.target.value = "";
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  }, [loadFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleTranslate = async () => {
    const targetLang = TARGET_LANGS.find((t) => t.code === targetLangCode) ?? TARGET_LANGS[0];
    const lines = sourceText.split(/\r?\n/);
    const total = lines.length;

    if (total === 0) {
      setError("No content to translate. Please add an SRT file first.");
      setTranslateState("error");
      return;
    }

    const chunks = Math.max(1, Math.ceil(total / CHUNK_SIZE));

    setTranslateState("running");
    setError("");
    setShowPreview(true);
    setProgress({
      processed: 0,
      total,
      chunk: 0,
      chunks,
      message: `Translating to ${targetLang.label}…`,
    });
    setTargetText("");

    const buffer: string[] = [];

    const REQUEST_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes per chunk (retries can be slow)

    for (let i = 0; i < chunks; i += 1) {
      const slice = lines.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const response = await fetch("/api/translate-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lines: slice,
            targetLanguage: targetLang.label,
            modelPreference: "auto",
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const data = await response.json();

        if (!response.ok || !data.ok || !Array.isArray(data.lines)) {
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
      } catch (err) {
        const isAbort = err instanceof Error && err.name === "AbortError";
        const message = isAbort
          ? "Request timed out. This chunk took too long; try again or use a smaller file."
          : err instanceof Error
            ? err.message
            : "Translation failed";
        setError(message);
        setTranslateState("error");
        setProgress((prev) => ({ ...prev, message }));
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    setTranslateState("done");
    setProgress((prev) => ({
      ...prev,
      message: `Completed translation to ${targetLang.label}.`,
    }));
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-14">
        <header className="flex flex-col gap-2">
          <a href="/" className="text-sm text-zinc-400 transition hover:text-zinc-200">
            ← Back to Global Cinema
          </a>
          <h1 className="text-3xl font-semibold sm:text-4xl">Translate SRT</h1>
          <p className="text-zinc-400">
            Drag and drop an English SRT file, pick a language, and download the translated subtitles.
          </p>
        </header>

        <main className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6">
            <div>
              <h2 className="mb-3 text-lg font-semibold text-zinc-100">1. Drop SRT file</h2>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-12 text-center transition ${
                  isDragging
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-zinc-700 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-900/70"
                }`}
              >
                <p className="text-zinc-300">
                  {sourceFileName ? (
                    <span className="font-medium text-emerald-400">{sourceFileName}</span>
                  ) : (
                    <>
                      Drag and drop your .srt file here
                      <br />
                      <span className="text-sm text-zinc-500">or click to choose</span>
                    </>
                  )}
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".srt,text/plain"
                className="hidden"
                onChange={handleFileSelect}
              />
              {progress.total > 0 && (
                <p className="mt-2 text-sm text-zinc-500">{progress.total} lines</p>
              )}
            </div>

            <div>
              <h2 className="mb-3 text-lg font-semibold text-zinc-100">2. Target language</h2>
              <select
                value={targetLangCode}
                onChange={(e) => setTargetLangCode(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 focus:border-emerald-500 focus:outline-none"
              >
                {TARGET_LANGS.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <h2 className="mb-3 text-lg font-semibold text-zinc-100">3. Translate</h2>
              <button
                type="button"
                onClick={handleTranslate}
                disabled={translateState === "running" || !sourceText.trim()}
                className="w-full rounded-xl bg-emerald-600 px-4 py-4 text-lg font-semibold text-emerald-50 transition hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {translateState === "running" ? "Translating…" : "Translate"}
              </button>
              <p className="mt-1 text-xs text-zinc-500">
                Uses 150-line chunks. Filler words (uh, um, etc.) are cleaned for natural subtitles.
              </p>
            </div>

            {(translateState === "running" || translateState === "done") && targetText && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-300">Live preview</h3>
                  <button
                    type="button"
                    onClick={() => setShowPreview((v) => !v)}
                    className="text-sm text-zinc-400 transition hover:text-zinc-200"
                  >
                    {showPreview ? "Hide" : "Show"}
                  </button>
                </div>
                {showPreview && (
                  <div className="max-h-64 overflow-auto rounded-lg border border-zinc-800 bg-zinc-900/80 p-3">
                    <pre className="whitespace-pre-wrap font-mono text-xs text-zinc-200">
                      {targetText}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {progress.message && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-zinc-400">
                  <span>Progress</span>
                  <span>
                    {progress.total > 0 ? `${progress.processed}/${progress.total} lines` : "Waiting"}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full bg-emerald-500 transition-[width]"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="text-sm text-zinc-400">{progress.message}</p>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-rose-500/20 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}

            {translateState === "done" && (
              <div className="rounded-lg bg-emerald-500/20 px-4 py-3 text-sm text-emerald-200">
                Translation complete. Download your file below.
              </div>
            )}

            <div>
              <h2 className="mb-3 text-lg font-semibold text-zinc-100">4. Download</h2>
              <button
                type="button"
                onClick={handleDownload}
                disabled={translateState !== "done"}
                className="w-full rounded-xl bg-zinc-700 px-4 py-4 text-lg font-semibold text-zinc-100 transition hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {translateState === "done" ? "Download translated .srt" : "Translation not ready"}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
