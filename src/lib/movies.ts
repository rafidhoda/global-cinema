/**
 * Movies shown on home and movie pages. No video streaming; download via Wormhole + subtitle downloads.
 */
export type Movie = {
  slug: string;
  title: string;
  year: number;
  /** Wormhole (or other) link to download the movie file */
  wormholeDownloadUrl: string;
  /** Raw English SRT URL for downloads and for "Translate subtitles" */
  englishSrtUrl?: string;
  /** WebVTT URL for English (if you add a player later) */
  subtitleUrl?: string;
};

/** Subtitle languages offered per movie: English first, then these for download/translate. */
export const SUBTITLE_LANGUAGES = [
  { label: "English", slug: "english" },
  { label: "Norwegian", slug: "norwegian" },
  { label: "Polish", slug: "polish" },
  { label: "Arabic", slug: "arabic" },
  { label: "Lithuanian", slug: "lithuanian" },
  { label: "Russian", slug: "russian" },
  { label: "Persian", slug: "persian" },
  { label: "Bangla", slug: "bengali" },
] as const;

const TZP_ENGLISH_SRT =
  "https://ytsbpnzahbtxpojtsjfh.supabase.co/storage/v1/object/public/movies/Taare%20Zameen%20Par%20(2007)%20-%20English.srt";

const PADMAN_ENGLISH_SRT =
  "https://ytsbpnzahbtxpojtsjfh.supabase.co/storage/v1/object/public/movies/Padman%20(2018)%20-%20English.srt";

export const MOVIES: Movie[] = [
  {
    slug: "taare-zameen-par-2007",
    title: "Taare Zameen Par",
    year: 2007,
    wormholeDownloadUrl: "https://wormhole.app/vbZ1bn#Hv21O3mfIQYMo39TTkzKrQ",
    englishSrtUrl: TZP_ENGLISH_SRT,
    subtitleUrl: `/api/subtitles/vtt?url=${encodeURIComponent(TZP_ENGLISH_SRT)}`,
  },
  {
    slug: "padman-2018",
    title: "Pad Man",
    year: 2018,
    wormholeDownloadUrl: "https://wormhole.app/",
    englishSrtUrl: PADMAN_ENGLISH_SRT,
    subtitleUrl: `/api/subtitles/vtt?url=${encodeURIComponent(PADMAN_ENGLISH_SRT)}`,
  },
  {
    slug: "lagaan-2001",
    title: "Lagaan",
    year: 2001,
    wormholeDownloadUrl: "https://wormhole.app/",
    englishSrtUrl: undefined,
    subtitleUrl: undefined,
  },
];

export function getMovie(slug: string): Movie | undefined {
  return MOVIES.find((m) => m.slug === slug);
}
