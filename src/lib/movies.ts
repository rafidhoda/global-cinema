/**
 * Add movies here to show a poster on the home grid and a watch page at /[slug].
 * Posters are fetched from TMDB (using TMDB_API_KEY or TMDB_READ_TOKEN). Add videoUrl + subtitle URLs for the player page.
 */
export type Movie = {
  slug: string;
  title: string;
  year: number;
  /** Filled by API from TMDB; optional in config */
  posterUrl?: string;
  videoUrl?: string;
  /** WebVTT URL for English (e.g. /api/subtitles/vtt?url=...) */
  subtitleUrl?: string;
  /** Raw English SRT URL for "Create Subtitles" and resume */
  englishSrtUrl?: string;
  /** Sneak peek: show "Let's go!" CTA while playback is within this range (seconds). */
  sneakPeekStartSeconds?: number;
  sneakPeekEndSeconds?: number;
  /** When user clicks "Let's go!" during sneak peek, seek video to this time (seconds). e.g. 121 = 2:01 */
  sneakPeekCtaSeekToSeconds?: number;
};

const TZP_ENGLISH_SRT =
  "https://ytsbpnzahbtxpojtsjfh.supabase.co/storage/v1/object/public/movies/Taare%20Zameen%20Par%20(2007)%20-%20English.srt";

const PADMAN_ENGLISH_SRT =
  "https://ytsbpnzahbtxpojtsjfh.supabase.co/storage/v1/object/public/movies/Padman%20(2018)%20-%20English.srt";

export const MOVIES: Movie[] = [
  {
    slug: "taare-zameen-par-2007",
    title: "Taare Zameen Par",
    year: 2007,
    videoUrl:
      "https://ytsbpnzahbtxpojtsjfh.supabase.co/storage/v1/object/public/movies/Taare%20Zameen%20Par%20(2007).mp4",
    englishSrtUrl: TZP_ENGLISH_SRT,
    subtitleUrl: `/api/subtitles/vtt?url=${encodeURIComponent(TZP_ENGLISH_SRT)}`,
    sneakPeekStartSeconds: 6560,
    sneakPeekEndSeconds: 6620,
    sneakPeekCtaSeekToSeconds: 0,
  },
  {
    slug: "padman-2018",
    title: "Padman",
    year: 2018,
    videoUrl:
      "https://ytsbpnzahbtxpojtsjfh.supabase.co/storage/v1/object/public/movies/Padman%20(2018).mp4",
    englishSrtUrl: PADMAN_ENGLISH_SRT,
    subtitleUrl: `/api/subtitles/vtt?url=${encodeURIComponent(PADMAN_ENGLISH_SRT)}`,
  },
];

export function getMovie(slug: string): Movie | undefined {
  return MOVIES.find((m) => m.slug === slug);
}
