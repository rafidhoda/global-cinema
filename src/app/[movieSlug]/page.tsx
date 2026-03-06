import { notFound } from "next/navigation";
import { getMovie } from "@/lib/movies";
import { getMovieDownloadLinks } from "@/lib/movie-download-links";
import { MovieDownloadPage } from "@/components/MovieDownloadPage";

type Props = { params: Promise<{ movieSlug: string }> };

export default async function MoviePage({ params }: Props) {
  const { movieSlug } = await params;
  const movie = getMovie(movieSlug);
  if (!movie) notFound();
  const links = await getMovieDownloadLinks();
  const wormholeUrl = links[movieSlug]?.trim() || movie.wormholeDownloadUrl;
  const movieWithLink = { ...movie, wormholeDownloadUrl: wormholeUrl || movie.wormholeDownloadUrl };
  return <MovieDownloadPage movieSlug={movieSlug} movie={movieWithLink} />;
}
