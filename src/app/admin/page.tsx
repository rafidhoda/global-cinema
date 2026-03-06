"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MOVIES, SUBTITLE_LANGUAGES } from "@/lib/movies";
import type { Movie } from "@/lib/movies";

const ADMIN_PASSWORD = "RafidHoda";
const STORAGE_KEY = "global-cinema-admin";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [links, setLinks] = useState<Record<string, string>>({});
  const [linkSaving, setLinkSaving] = useState<string | null>(null);
  const [subtitleUploading, setSubtitleUploading] = useState<string | null>(null);
  const [subtitleError, setSubtitleError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [mp4File, setMp4File] = useState<File | null>(null);
  const [srtFile, setSrtFile] = useState<File | null>(null);
  const [mp4DropActive, setMp4DropActive] = useState(false);
  const [srtDropActive, setSrtDropActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    slug: string;
    title: string;
    year: number;
    videoUrl: string;
    englishSrtUrl: string;
    subtitleUrl: string;
  } | null>(null);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(STORAGE_KEY) === "1") {
      setAuthed(true);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetch("/api/movie-download-links")
      .then((r) => r.json())
      .then((data) => setLinks(data?.links ?? {}))
      .catch(() => setLinks({}));
  }, [authed]);

  const handleLogin = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setPasswordError("");
      if (password.trim() === ADMIN_PASSWORD) {
        if (typeof window !== "undefined") {
          sessionStorage.setItem(STORAGE_KEY, "1");
        }
        setAuthed(true);
        setPassword("");
      } else {
        setPasswordError("Wrong password");
      }
    },
    [password]
  );

  const saveWormholeLink = useCallback(
    async (movie: Movie) => {
      const url = (links[movie.slug] ?? movie.wormholeDownloadUrl ?? "").trim();
      setLinkSaving(movie.slug);
      try {
        const res = await fetch("/api/admin/movie-download-link", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Password": ADMIN_PASSWORD,
          },
          body: JSON.stringify({ slug: movie.slug, wormholeUrl: url }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setLinks((prev) => ({ ...prev, [movie.slug]: url }));
        }
      } finally {
        setLinkSaving(null);
      }
    },
    [links]
  );

  const handleUploadSubtitle = useCallback(
    async (movieSlug: string, languageLabel: string, file: File) => {
      setSubtitleError(null);
      setSubtitleUploading(`${movieSlug}-${languageLabel}`);
      try {
        const content = await file.text();
        const res = await fetch("/api/subtitles/upload-movie-of-the-week", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            movieSlug,
            language: languageLabel,
            content,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setSubtitleError(data?.error ?? "Upload failed");
          return;
        }
      } catch (err) {
        setSubtitleError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setSubtitleUploading(null);
      }
    },
    []
  );

  const handleMp4Drop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setMp4DropActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("video/")) {
      setMp4File(file);
    }
  }, []);

  const handleSrtDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setSrtDropActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith(".srt") || file.type === "application/x-subrip" || file.type === "text/plain")) {
      setSrtFile(file);
    }
  }, []);

  const handleMp4Input = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setMp4File(file);
  }, []);

  const handleSrtInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSrtFile(file);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setUploadError("");
      setUploadResult(null);
      if (!title.trim() || !year.trim()) {
        setUploadError("Title and year are required.");
        return;
      }
      if (!mp4File) {
        setUploadError("Please add an MP4 file.");
        return;
      }
      if (!srtFile) {
        setUploadError("Please add English subtitles (SRT file).");
        return;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        formData.set("title", title.trim());
        formData.set("year", year.trim());
        formData.set("mp4", mp4File);
        formData.set("subtitles", srtFile);

        const res = await fetch("/api/admin/upload-movie", {
          method: "POST",
          headers: {
            "X-Admin-Password": ADMIN_PASSWORD,
          },
          body: formData,
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setUploadError(data?.error ?? `Upload failed (${res.status})`);
          return;
        }
        setUploadResult({
          slug: data.slug,
          title: data.title,
          year: data.year,
          videoUrl: data.videoUrl,
          englishSrtUrl: data.englishSrtUrl,
          subtitleUrl: data.subtitleUrl,
        });
        setMp4File(null);
        setSrtFile(null);
        setTitle("");
        setYear("");
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [title, year, mp4File, srtFile]
  );

  if (!authed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 px-4">
        <h1 className="text-2xl font-semibold text-white">Admin</h1>
        <form onSubmit={handleLogin} className="flex w-full max-w-sm flex-col gap-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            autoFocus
          />
          <button
            type="submit"
            className="rounded-lg bg-amber-500 px-4 py-3 font-medium text-black transition hover:bg-amber-400"
          >
            Log in
          </button>
          {passwordError && <p className="text-sm text-rose-400">{passwordError}</p>}
        </form>
        <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-300">
          ← Back to site
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-white">Admin</h1>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => {
                sessionStorage.removeItem(STORAGE_KEY);
                setAuthed(false);
              }}
              className="text-sm text-zinc-400 hover:text-zinc-300"
            >
              Log out
            </button>
            <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-300">
              ← Back to site
            </Link>
          </div>
        </div>

        {/* Manage existing movies: wormhole link + upload subtitles */}
        <section className="mb-12">
          <h2 className="mb-4 text-lg font-semibold text-white">Manage movies</h2>
          <p className="mb-6 text-sm text-zinc-500">
            Set the download (Wormhole) link and upload subtitles for each movie.
          </p>
          <div className="flex flex-col gap-6">
            {MOVIES.map((movie) => (
              <div
                key={movie.slug}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6"
              >
                <h3 className="text-lg font-medium text-white">
                  {movie.title} ({movie.year})
                </h3>
                <p className="mt-0.5 text-xs text-zinc-500">{movie.slug}</p>

                <div className="mt-4">
                  <label className="mb-1 block text-sm font-medium text-zinc-400">
                    Wormhole download link
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="url"
                      value={links[movie.slug] ?? movie.wormholeDownloadUrl ?? ""}
                      onChange={(e) =>
                        setLinks((prev) => ({ ...prev, [movie.slug]: e.target.value }))
                      }
                      placeholder="https://wormhole.app/..."
                      className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => saveWormholeLink(movie)}
                      disabled={linkSaving === movie.slug}
                      className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-black transition hover:bg-amber-400 disabled:opacity-50"
                    >
                      {linkSaving === movie.slug ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium text-zinc-400">
                    Upload new subtitle
                  </label>
                  <div className="flex flex-wrap items-end gap-3">
                    <select
                      id={`lang-${movie.slug}`}
                      className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      {SUBTITLE_LANGUAGES.map((lang) => (
                        <option key={lang.slug} value={lang.label}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="file"
                      accept=".srt,application/x-subrip,text/plain"
                      className="hidden"
                      id={`srt-${movie.slug}`}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        const select = document.getElementById(`lang-${movie.slug}`) as HTMLSelectElement;
                        const lang = select?.value ?? "English";
                        if (file && lang) {
                          await handleUploadSubtitle(movie.slug, lang, file);
                        }
                        e.target.value = "";
                      }}
                    />
                    <label
                      htmlFor={`srt-${movie.slug}`}
                      className="cursor-pointer rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-700"
                    >
                      Choose SRT file
                    </label>
                    {subtitleUploading?.startsWith(movie.slug) && (
                      <span className="text-sm text-amber-400">Uploading…</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {subtitleError && (
            <p className="mt-3 text-sm text-rose-400">{subtitleError}</p>
          )}
        </section>

        {/* Upload new movie (full movie + English SRT) */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">Upload new movie</h2>
          <p className="mb-6 text-sm text-zinc-500">
            Add a new movie: MP4 file and English SRT. Then add the snippet to{" "}
            <code className="rounded bg-zinc-800 px-1 py-0.5">src/lib/movies.ts</code>.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-300">Movie title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Taare Zameen Par"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-300">Year</label>
              <input
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g. 2007"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-300">MP4 file</label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setMp4DropActive(true);
                }}
                onDragLeave={() => setMp4DropActive(false)}
                onDrop={handleMp4Drop}
                className={`flex min-h-[100px] flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 transition ${
                  mp4DropActive
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-zinc-600 bg-zinc-900/50 hover:border-zinc-500"
                }`}
              >
                <input
                  type="file"
                  accept="video/mp4,.mp4"
                  onChange={handleMp4Input}
                  className="hidden"
                  id="admin-mp4"
                />
                <label htmlFor="admin-mp4" className="cursor-pointer text-center text-zinc-400 hover:text-zinc-300">
                  {mp4File ? (
                    <span className="font-medium text-emerald-400">{mp4File.name}</span>
                  ) : (
                    "Drop MP4 here or click to choose"
                  )}
                </label>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-300">English subtitles (SRT)</label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setSrtDropActive(true);
                }}
                onDragLeave={() => setSrtDropActive(false)}
                onDrop={handleSrtDrop}
                className={`flex min-h-[100px] flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 transition ${
                  srtDropActive
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-zinc-600 bg-zinc-900/50 hover:border-zinc-500"
                }`}
              >
                <input
                  type="file"
                  accept=".srt,application/x-subrip,text/plain"
                  onChange={handleSrtInput}
                  className="hidden"
                  id="admin-srt"
                />
                <label htmlFor="admin-srt" className="cursor-pointer text-center text-zinc-400 hover:text-zinc-300">
                  {srtFile ? (
                    <span className="font-medium text-emerald-400">{srtFile.name}</span>
                  ) : (
                    "Drop SRT here or click to choose"
                  )}
                </label>
              </div>
            </div>
            {uploadError && <p className="text-sm text-rose-400">{uploadError}</p>}
            <button
              type="submit"
              disabled={uploading}
              className="rounded-xl bg-amber-500 px-6 py-4 text-lg font-medium text-black transition hover:bg-amber-400 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Upload movie"}
            </button>
          </form>
          {uploadResult && (
            <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-900/50 p-6">
              <h3 className="mb-3 text-lg font-semibold text-emerald-400">Upload complete</h3>
              <p className="mb-4 text-sm text-zinc-400">
                Add this movie to <code className="rounded bg-zinc-800 px-1 py-0.5">src/lib/movies.ts</code>:
              </p>
              <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-xs text-zinc-300">
                {`{
  slug: "${uploadResult.slug}",
  title: "${uploadResult.title}",
  year: ${uploadResult.year},
  wormholeDownloadUrl: "https://wormhole.app/...",  // paste your link, or set in Admin → Manage movies
  englishSrtUrl: "${uploadResult.englishSrtUrl.replace(/"/g, '\\"')}",
  subtitleUrl: "${uploadResult.subtitleUrl.replace(/"/g, '\\"')}",
},`}
              </pre>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
