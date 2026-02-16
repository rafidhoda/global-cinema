import { MovieOfTheWeek } from "@/components/MovieOfTheWeek";

const VIDEO_URL =
  "https://ytsbpnzahbtxpojtsjfh.supabase.co/storage/v1/object/public/movies/Taare%20Zameen%20Par%20(2007).mp4";

const SUBTITLE_SRT_URL =
  "https://ytsbpnzahbtxpojtsjfh.supabase.co/storage/v1/object/public/movies/Taare%20Zameen%20Par%20(2007)%20-%20English.srt";

// Serve as VTT via API so <track> works in all browsers (they require WebVTT, not raw SRT)
const SUBTITLE_URL = `/api/subtitles/vtt?url=${encodeURIComponent(SUBTITLE_SRT_URL)}`;

export default function Home() {
  return (
    <div className="min-h-screen bg-black">
      <MovieOfTheWeek
        videoUrl={VIDEO_URL}
        subtitleUrl={SUBTITLE_URL}
        englishSrtUrl={SUBTITLE_SRT_URL}
        headline="Taare Zameen Par (2007)"
      />
    </div>
  );
}
