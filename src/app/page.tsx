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

const CHUNK_SIZE = 30;
const ACTIVE_MODEL = process.env.OPENAI_MODEL || "gpt-4.1";

type TargetLang = {
  code: string;
  label: string;
  voicePrefix: string;
};

const TARGET_LANGS: TargetLang[] = [
  { code: "en-US", label: "English", voicePrefix: "en" },
  { code: "no-NO", label: "Norwegian", voicePrefix: "no" },
  { code: "pl-PL", label: "Polish", voicePrefix: "pl" },
  { code: "hi-IN", label: "Hindi", voicePrefix: "hi" },
  { code: "ar-SA", label: "Arabic", voicePrefix: "ar" },
  { code: "ur-PK", label: "Urdu", voicePrefix: "ur" },
];

export default function Home() {
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
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [englishVoice, setEnglishVoice] = useState<string>("");
  const [targetVoice, setTargetVoice] = useState<string>("");
  const [sourceFileName, setSourceFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [targetLangCode, setTargetLangCode] = useState<string>(TARGET_LANGS[0].code);

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

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const preferredNames: Record<string, string[]> = {
      en: [
        "Google US English",
        "Google UK English Female",
        "Google UK English Male",
        "Microsoft Aria Online (Natural)",
        "Samantha",
        "Karen",
      ],
      no: ["Google norsk"],
      pl: ["Google polski", "Zosia"],
      hi: ["Google हिन्दी"],
      ar: ["Google العربية"],
      ur: ["Google اُردُو"],
      es: ["Google español", "Google español de Estados Unidos", "Monica"],
      fr: ["Google français", "Thomas"],
      de: ["Google Deutsch", "Hans"],
      it: ["Google italiano", "Alice"],
    };

    const pickBestVoice = (
      allVoices: SpeechSynthesisVoice[],
      langPrefix: string,
      preferred: string[]
    ) => {
      for (const name of preferred) {
        const match = allVoices.find(
          (v) =>
            v.name.toLowerCase() === name.toLowerCase() &&
            v.lang.toLowerCase().startsWith(langPrefix)
        );
        if (match) return match;
      }
      return (
        allVoices.find((v) => v.lang.toLowerCase().startsWith(langPrefix)) ||
        allVoices[0]
      );
    };

    const loadVoices = () => {
      const list = window.speechSynthesis.getVoices();
      if (!list || list.length === 0) {
        // some browsers need another tick
        setTimeout(loadVoices, 150);
        return;
      }
      setVoices(list);
      const en = pickBestVoice(list, "en", preferredNames.en);
      const targetLang = TARGET_LANGS.find((t) => t.code === targetLangCode);
      const targetPrefix = targetLang?.voicePrefix || "pl";
      const targetPrefs = preferredNames[targetPrefix] || [];
      const tgt = pickBestVoice(list, targetPrefix, targetPrefs);
      setEnglishVoice(en?.name || "");
      setTargetVoice(tgt?.name || "");
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, [targetLangCode]);

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

  const speakText = (text: string, lang: string, voiceName?: string) => {
    if (typeof window === "undefined" || !text.trim()) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    if (voiceName) {
      const voice = voices.find((v) => v.name === voiceName);
      if (voice) utterance.voice = voice;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const handleTranslateInChunks = async () => {
    const targetLang =
      TARGET_LANGS.find((t) => t.code === targetLangCode) ?? TARGET_LANGS[0];
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
          body: JSON.stringify({ lines: slice, targetLanguage: targetLang.label }),
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
        const message =
          error instanceof Error ? error.message : "Unable to translate chunk.";
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
            Paste or upload subtitles on the left. We translate in small batches, preserving the exact SRT structure.
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
                Translate in {CHUNK_SIZE}-line batches
              </h2>
              <p className="text-sm text-zinc-400">
                Uses OpenAI {ACTIVE_MODEL} with strict line-for-line preservation (indices/timecodes unchanged).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-400">Target:</span>
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
                disabled={translateState === "running"}
              >
                {translateState === "running"
                  ? "Translating…"
                  : `Translate ${CHUNK_SIZE}-line batches`}
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
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded bg-emerald-600 px-3 py-1 text-emerald-50 transition hover:bg-emerald-500"
                >
                  Upload .srt
                </button>
                {sourceFileName && (
                  <span className="truncate text-zinc-400">
                    Loaded: {sourceFileName}
                  </span>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".srt,text/plain"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <select
                value={englishVoice}
                onChange={(e) => setEnglishVoice(e.target.value)}
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
              >
                {voices
                  .filter((v) => v.lang.toLowerCase().startsWith("en"))
                  .map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                {voices.filter((v) => v.lang.toLowerCase().startsWith("en")).length ===
                  0 && <option>No English voices found</option>}
              </select>
              <button
                type="button"
                onClick={() => speakText(sourceText, "en-US", englishVoice)}
                className="rounded bg-zinc-800 px-3 py-1 text-zinc-200 transition hover:bg-zinc-700"
              >
                Read English aloud
              </button>
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
                <span>Translated output</span>
                <span>{targetText.split(/\r?\n/).filter(Boolean).length} lines</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <select
                  value={targetVoice}
                  onChange={(e) => setTargetVoice(e.target.value)}
                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
                >
                  {voices
                    .filter((v) =>
                      v.lang.toLowerCase().startsWith(
                        (TARGET_LANGS.find((t) => t.code === targetLangCode)?.voicePrefix ||
                          "pl")
                      )
                    )
                    .map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  {voices.filter((v) =>
                    v.lang
                      .toLowerCase()
                      .startsWith(
                        (TARGET_LANGS.find((t) => t.code === targetLangCode)?.voicePrefix ||
                          "pl")
                      )
                  ).length === 0 && <option>No voices found</option>}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    speakText(
                      targetText,
                      targetLangCode,
                      targetVoice
                    )
                  }
                  className="rounded bg-zinc-800 px-3 py-1 text-zinc-200 transition hover:bg-zinc-700"
                >
                  Read aloud
                </button>
              </div>
              <textarea
                value={targetText}
                onChange={(e) => setTargetText(e.target.value)}
                className="h-[520px] w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900/80 p-4 font-mono text-sm text-zinc-100 outline-none ring-0 transition focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                placeholder="Translated text appears here in 100-line batches."
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
            {translateState === "done" && (
              <div className="text-sm font-medium text-emerald-300">
                Translation completed. Polish subtitles are ready on the right.
              </div>
            )}
            {translateState === "error" && (
              <div className="text-sm font-medium text-rose-300">
                Translation failed. Check the text and try again.
              </div>
            )}
        </div>
      </main>
      </div>
    </div>
  );
}
