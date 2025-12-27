"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Movie } from "@/types/movies";
import { PosterWall } from "@/components/PosterWall";

type Props = {
  results: Movie[];
};

export function MovieAccess({ results }: Props) {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [openMovie, setOpenMovie] = useState<Movie | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadMessage, setUploadMessage] = useState<string>("");
  const [englishUrl, setEnglishUrl] = useState<string | null>(null);
  const posters = useMemo(
    () =>
      results
        .map((r) => (r.poster_path ? `https://image.tmdb.org/t/p/w342${r.poster_path}` : null))
        .filter(Boolean)
        .slice(0, 18) as string[],
    [results]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("gc_pass_ok");
    const savedAdmin = localStorage.getItem("gc_admin_ok");
    if (saved === "true" || savedAdmin === "true") {
      setUnlocked(true);
      setIsAdmin(savedAdmin === "true");
    }
  }, []);

  useEffect(() => {
    const fetchEnglish = async () => {
      if (!openMovie?.id) {
        setEnglishUrl(null);
        return;
      }
      try {
        const res = await fetch("/api/subtitles/list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ movieId: openMovie.id, language: "en" }),
        });
        const data = await res.json();
        if (res.ok && data.ok && data.url) {
          setEnglishUrl(data.url as string);
        } else {
          setEnglishUrl(null);
        }
      } catch {
        setEnglishUrl(null);
      }
    };
    fetchEnglish();
  }, [openMovie]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "ThisIsRafidHoda!1991") {
      setUnlocked(true);
      setIsAdmin(true);
      if (typeof window !== "undefined") {
        localStorage.setItem("gc_pass_ok", "true");
        localStorage.setItem("gc_admin_ok", "true");
      }
    } else if (password === "hoda") {
      setUnlocked(true);
      setIsAdmin(false);
      if (typeof window !== "undefined") {
        localStorage.setItem("gc_pass_ok", "true");
        localStorage.removeItem("gc_admin_ok");
      }
    } else {
      setUnlocked(false);
      setIsAdmin(false);
    }
  };

  const handleLogout = () => {
    setUnlocked(false);
    setOpenMovie(null);
    setPassword("");
    if (typeof window !== "undefined") {
      localStorage.removeItem("gc_pass_ok");
      localStorage.removeItem("gc_admin_ok");
    }
  };

  if (!unlocked) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        {posters.length > 0 && <PosterWall posters={posters} />}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/55" />
        <div className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 text-center">
          <div className="mb-8 flex flex-col gap-3">
            <h1 className="font-serif text-5xl font-semibold text-white sm:text-6xl md:text-7xl">
              Global Cinema
            </h1>
            <p className="text-lg text-zinc-200">
              Curated films by Rafid Hoda you can watch in any language
            </p>
          </div>
          <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-black/70 p-6 shadow-2xl backdrop-blur">
            <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 rounded border border-zinc-800 bg-zinc-900 px-3 py-3 text-base text-zinc-100 focus:border-emerald-500 focus:outline-none"
                  placeholder="Password"
                />
                <button
                  type="submit"
                  className="rounded bg-emerald-600 px-4 py-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 sm:w-auto cursor-pointer"
                >
                  Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12 bg-black">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold text-white">{isAdmin ? "Welcome, Rafid" : "Library"}</h2>
          <p className="text-sm text-zinc-400">Browse and manage your curated films.</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          aria-label="Log out"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-4 w-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l3-3m0 0l3 3m-3-3v12"
            />
          </svg>
          <span>Logout</span>
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((movie) => {
          const Card = (
            <div className="flex gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-lg">
              <div className="relative h-32 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-900">
                {movie.poster_path ? (
                  <Image
                    src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
                    alt={movie.title || "Movie poster"}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
                    No poster
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-white">
                    {movie.title}
                    {movie.release_year ? ` (${movie.release_year})` : ""}
                  </h3>
                  <p className="text-xs text-zinc-400 line-clamp-4">
                    {movie.overview || "No synopsis available."}
                  </p>
                </div>
              </div>
            </div>
          );

          return (
            <button
              key={movie.id || movie.title}
              onClick={() => setOpenMovie(movie)}
              className="transition hover:-translate-y-1 hover:shadow-emerald-500/20 text-left cursor-pointer"
            >
              {Card}
            </button>
          );
        })}
      </div>

      {openMovie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <h3 className="text-lg font-semibold text-zinc-100">
                {openMovie.title}
                {openMovie.release_year ? ` (${openMovie.release_year})` : ""}
              </h3>
              <button
                type="button"
                onClick={() => setOpenMovie(null)}
                className="rounded bg-zinc-800 px-3 py-1 text-sm text-zinc-100 transition hover:bg-zinc-700 cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="flex flex-col gap-4 p-4 sm:flex-row">
              <div className="relative h-80 w-56 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-900">
                {openMovie.poster_path ? (
                  <Image
                    src={`https://image.tmdb.org/t/p/w342${openMovie.poster_path}`}
                    alt={openMovie.title || "Poster"}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
                    No poster
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-4">
                <p className="text-sm text-zinc-300">{openMovie.overview || "No synopsis available."}</p>
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (openMovie.external_link) {
                        window.open(openMovie.external_link, "_blank", "noopener,noreferrer");
                      }
                    }}
                    disabled={!openMovie.external_link}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    Download Movie
                  </button>
                  <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                    <div className="text-sm font-semibold text-zinc-100">Subtitles</div>
                    <div className="flex flex-col gap-3 text-xs text-zinc-400">
                      <div className="flex gap-3">
                        <button
                          type="button"
                          disabled={!englishUrl}
                          onClick={() => {
                            if (englishUrl) window.open(englishUrl, "_blank", "noopener,noreferrer");
                          }}
                        className={`rounded px-3 py-2 text-zinc-200 transition cursor-pointer ${
                            englishUrl
                              ? "bg-emerald-600 hover:bg-emerald-500"
                              : "bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                          }`}
                        >
                          English {englishUrl ? "(download)" : "(upload to add)"}
                        </button>
                        <button
                          type="button"
                          disabled
                        className="rounded bg-zinc-800 px-3 py-2 text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                        >
                          Polish (coming soon)
                        </button>
                      </div>
                      {isAdmin && (
                        <div className="flex flex-col gap-2">
                          <label className="text-xs text-zinc-400">Upload English subtitles (.srt)</label>
                          <input
                            type="file"
                            accept=".srt,text/plain"
                            onChange={async (e) => {
                              if (!openMovie?.id) {
                                setUploadMessage("Missing movie id; cannot upload.");
                                return;
                              }
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setUploading(true);
                              setUploadMessage("");
                              try {
                                const form = new FormData();
                                form.append("movieId", openMovie.id);
                                form.append("language", "en");
                                form.append("file", file);
                                const res = await fetch("/api/subtitles/upload", {
                                  method: "POST",
                                  body: form,
                                });
                                const data = await res.json();
                                if (!res.ok || !data.ok) {
                                  setUploadMessage(data?.error || "Upload failed");
                                } else {
                                  setUploadMessage("Uploaded successfully.");
                                  if (data.url) setEnglishUrl(data.url as string);
                                }
                              } catch (err) {
                                setUploadMessage("Upload failed.");
                              } finally {
                                setUploading(false);
                                e.target.value = "";
                              }
                            }}
                            className="text-sm text-zinc-200"
                          />
                          {uploading && <span className="text-emerald-400">Uploading…</span>}
                          {uploadMessage && <span className="text-emerald-300">{uploadMessage}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

