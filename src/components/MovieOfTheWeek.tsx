"use client";

import { useRef, useState } from "react";

type Props = {
  videoUrl: string;
  subtitleUrl?: string;
};

export function MovieOfTheWeek({ videoUrl, subtitleUrl }: Props) {
  const hasVideo = Boolean(videoUrl?.trim());
  const videoRef = useRef<HTMLVideoElement>(null);
  const [subtitlesOn, setSubtitlesOn] = useState(false);

  const toggleSubtitles = () => {
    const video = videoRef.current;
    if (!video?.textTracks?.length) return;
    const track = video.textTracks[0];
    if (track.mode === "showing") {
      track.mode = "disabled";
      setSubtitlesOn(false);
    } else {
      track.mode = "showing";
      setSubtitlesOn(true);
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
        </video>
      </div>
      {subtitleUrl && (
        <button
          type="button"
          onClick={toggleSubtitles}
          className={`mt-4 rounded-lg px-4 py-2 text-sm font-medium transition ${
            subtitlesOn
              ? "bg-emerald-600 text-white"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          English Subtitles {subtitlesOn ? "✓" : ""}
        </button>
      )}
    </div>
  );
}
