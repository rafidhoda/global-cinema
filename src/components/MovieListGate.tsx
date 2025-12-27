"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Movie = {
  title?: string;
  release_date?: string;
  poster_path?: string;
  overview?: string;
};

type Result = {
  query: string;
  found: Movie | null;
};

export function MovieListGate({ results }: { results: Result[] }) {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  // Load saved state from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("gc_pass_ok");
    if (saved === "true") {
      setUnlocked(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "hoda") {
      setUnlocked(true);
      if (typeof window !== "undefined") {
        localStorage.setItem("gc_pass_ok", "true");
      }
    } else {
      setUnlocked(false);
    }
  };

  if (!unlocked) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 shadow-lg max-w-xl">
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <h2 className="text-lg font-semibold text-white">Enter password to view films</h2>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            placeholder="Password"
          />
          <button
            type="submit"
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          >
            Unlock
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {results.map(({ query, found }) => {
        const href =
          query === "Pad Man"
            ? "https://drive.google.com/file/d/1p9Yhl_QftF_NDI5BqxYPGLOQZIRxdA88/view?usp=sharing"
            : undefined;
        const Card = (
          <div className="flex gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 shadow-lg">
            <div className="relative h-32 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-900">
              {found?.poster_path ? (
                <Image
                  src={`https://image.tmdb.org/t/p/w342${found.poster_path}`}
                  alt={found.title || query}
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
                <h2 className="text-lg font-semibold text-white">
                  {found?.title ?? query}
                  {found?.release_date ? ` (${found.release_date.slice(0, 4)})` : ""}
                </h2>
                <p className="text-xs text-zinc-400 line-clamp-4">
                  {found?.overview || "No synopsis available."}
                </p>
              </div>
            </div>
          </div>
        );

        if (href) {
          return (
            <a
              key={query}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:-translate-y-1 hover:shadow-emerald-500/20"
            >
              {Card}
            </a>
          );
        }

        return (
          <div key={query} className="transition hover:-translate-y-1 hover:shadow-emerald-500/20">
            {Card}
          </div>
        );
      })}
    </div>
  );
}

