export type Movie = {
  id: string;
  title: string;
  release_year?: number | null;
  poster_path?: string | null;
  overview?: string | null;
  external_link?: string | null;
};

export type MovieMeta = {
  release_year?: number | null;
  poster_path?: string | null;
  overview?: string | null;
};

