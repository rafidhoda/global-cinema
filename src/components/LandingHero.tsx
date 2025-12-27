import { Playfair_Display } from "next/font/google";

type Props = {
  title: string;
  subtitle: string;
};

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export function LandingHero({ title, subtitle }: Props) {
  return (
    <div className="relative z-10 flex min-h-[60vh] w-full items-center justify-center px-6 py-16 text-center">
      <div className="flex flex-col gap-3">
        <h1
          className={`${playfair.className} text-5xl font-semibold text-white sm:text-6xl md:text-7xl`}
        >
          {title}
        </h1>
        <p className="text-lg text-zinc-200">{subtitle}</p>
      </div>
    </div>
  );
}

