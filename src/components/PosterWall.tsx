import Image from "next/image";

type Props = {
  posters: string[];
};

export function PosterWall({ posters }: Props) {
  if (posters.length === 0) return null;
  return (
    <div className="absolute inset-0 opacity-60">
      <div className="grid h-full w-full grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-6">
        {posters.map((src, idx) => (
          <div key={idx} className="relative h-40 sm:h-48 md:h-56 overflow-hidden">
            <Image
              src={src}
              alt="poster"
              fill
              className="object-cover"
              sizes="120px"
              priority={idx < 6}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

