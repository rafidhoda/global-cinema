import Link from "next/link";

export default function ArchiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black">
      <header className="sticky top-0 z-20 border-b border-zinc-800/80 bg-black/90 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link
            href="/"
            className="text-sm text-zinc-400 transition hover:text-zinc-200"
          >
            ← Movie of the week
          </Link>
          <span className="text-lg font-semibold text-white">Archive</span>
        </div>
      </header>
      {children}
    </div>
  );
}
