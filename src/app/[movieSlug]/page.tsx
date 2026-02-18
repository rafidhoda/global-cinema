import Link from "next/link";
import { notFound } from "next/navigation";
import { getMovie } from "@/lib/movies";
import { MovieOfTheWeek } from "@/components/MovieOfTheWeek";

type Props = { params: Promise<{ movieSlug: string }> };

export default async function MoviePage({ params }: Props) {
  const { movieSlug } = await params;
  const movie = getMovie(movieSlug);
  if (!movie) notFound();
  if (!movie.videoUrl) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black">
        <p className="text-zinc-500">
          {movie.title} ({movie.year}) — coming soon
        </p>
        <Link href="/" className="text-sm text-emerald-400 hover:underline">
          ← Back to movies
        </Link>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-white"
        >
          ← Back to movies
        </Link>
      </div>
      <MovieOfTheWeek
        movieSlug={movieSlug}
        videoUrl={movie.videoUrl}
        subtitleUrl={movie.subtitleUrl}
        englishSrtUrl={movie.englishSrtUrl}
        headline={`${movie.title} (${movie.year})`}
      />
    </div>
  );
}
