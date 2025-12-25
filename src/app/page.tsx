"use client";

import { useEffect, useMemo, useState } from "react";

type StatusState = "idle" | "checking" | "ok" | "error";

type Status = {
  state: StatusState;
  message: string;
  detail?: string;
};

type CopyState = "idle" | "running" | "done" | "error";

export default function Home() {
  const [status, setStatus] = useState<Status>({
    state: "idle",
    message: "Waiting to check connection…",
  });

  const [sourceText, setSourceText] = useState("");
  const [targetText, setTargetText] = useState("");
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [progress, setProgress] = useState({
    processed: 0,
    total: 0,
    chunk: 0,
    chunks: 0,
    message: "",
  });

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
      const message =
        error instanceof Error ? error.message : "Unable to reach OpenAI";
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

  const handleCopyInChunks = async () => {
    const lines = sourceText.split(/\r?\n/);
    const total = lines.length;

    if (total === 0) {
      setCopyState("error");
      setProgress((prev) => ({
        ...prev,
        processed: 0,
        total: 0,
        chunk: 0,
        chunks: 0,
        message: "Paste subtitle text on the left before processing.",
      }));
      return;
    }

    const chunkSize = 100;
    const chunks = Math.max(1, Math.ceil(total / chunkSize));

    setCopyState("running");
    setProgress({
      processed: 0,
      total,
      chunk: 0,
      chunks,
      message: "Starting chunked copy…",
    });
    setTargetText("");

    const buffer: string[] = [];

    for (let i = 0; i < chunks; i += 1) {
      const slice = lines.slice(i * chunkSize, (i + 1) * chunkSize);
      buffer.push(...slice);
      setTargetText(buffer.join("\n"));

      const processed = Math.min((i + 1) * chunkSize, total);
      setProgress({
        processed,
        total,
        chunk: i + 1,
        chunks,
        message: `Copied chunk ${i + 1} of ${chunks} (${processed}/${total} lines)`,
      });

      // Small pause so progress is visible; adjust or remove as needed.
      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    setCopyState("done");
    setProgress((prev) => ({
      ...prev,
      message: "Completed copy in 100-line batches.",
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-14">
        <header className="flex flex-col gap-3">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">
            Global Cinema Labs
          </p>
          <h1 className="text-4xl font-semibold sm:text-5xl">
            Subtitle translation workspace
          </h1>
          <p className="max-w-3xl text-lg text-zinc-400">
            Paste the English subtitles on the left. We&apos;ll move them to the
            right in 100-line batches so you can translate safely with progress
            you can trust.
          </p>
        </header>

        <section className="flex flex-col gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-6 shadow-2xl shadow-black/40 backdrop-blur">
          <div className="flex flex-wrap items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${badgeColor}`}
              >
                <span className="h-2 w-2 rounded-full bg-current opacity-80" />
                <span>{status.message}</span>
              </div>
              {status.detail && (
                <span className="text-sm text-zinc-400">{status.detail}</span>
              )}
            </div>
            <button
              onClick={checkConnection}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={status.state === "checking"}
            >
              {status.state === "checking" ? "Checking…" : "Re-check OpenAI"}
            </button>
          </div>
        </section>

        <main className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-xl border border-zinc-800/70 bg-zinc-900/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-zinc-100">
                Chunked copy (100 lines at a time)
              </h2>
              <p className="text-sm text-zinc-400">
                We process the left text in batches to keep progress clear and avoid missed lines.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleCopyInChunks}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={copyState === "running"}
              >
                {copyState === "running" ? "Copying…" : "Copy in 100-line batches"}
              </button>
              <div className="text-sm text-zinc-400">
                {progress.total > 0
                  ? `${progress.processed}/${progress.total} lines`
                  : "Idle"}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-xl border border-zinc-800/70 bg-zinc-950/70 p-4">
              <div className="flex items-center justify-between text-sm text-zinc-400">
                <span>Source (English)</span>
                <span>{sourceText.split(/\r?\n/).filter(Boolean).length} lines</span>
              </div>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                className="h-[520px] w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900/80 p-4 font-mono text-sm text-zinc-100 outline-none ring-0 transition focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                placeholder="Paste your English subtitle text here (one line per subtitle entry)…"
              />
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-zinc-800/70 bg-zinc-950/70 p-4">
              <div className="flex items-center justify-between text-sm text-zinc-400">
                <span>Working copy (ready for translation)</span>
                <span>{targetText.split(/\r?\n/).filter(Boolean).length} lines</span>
              </div>
              <textarea
                value={targetText}
                onChange={(e) => setTargetText(e.target.value)}
                className="h-[520px] w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900/80 p-4 font-mono text-sm text-zinc-100 outline-none ring-0 transition focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                placeholder="After processing, text appears here in 100-line batches."
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-zinc-800/70 bg-zinc-900/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-300">
              <span className="font-medium text-zinc-100">
                Progress: {percent}% ({progress.processed}/{progress.total || "0"} lines)
              </span>
              <span className="text-zinc-400">
                {progress.chunk > 0
                  ? `Chunk ${progress.chunk} of ${progress.chunks || "—"}`
                  : "Waiting to start"}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-emerald-500 transition-[width]"
                style={{ width: `${percent}%` }}
              />
            </div>
            {progress.message && (
              <div className="text-sm text-zinc-400">{progress.message}</div>
            )}
            {copyState === "done" && (
              <div className="text-sm font-medium text-emerald-300">
                Done. Text is copied in full. You can translate in the right pane or run again.
              </div>
            )}
            {copyState === "error" && (
              <div className="text-sm font-medium text-rose-300">
                Unable to start. Add text on the left and try again.
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
