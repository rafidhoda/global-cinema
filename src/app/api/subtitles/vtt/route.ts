import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fetches an SRT file from a URL and converts it to WebVTT for use in <track>.
 * Browsers require WebVTT for native subtitle tracks; SRT is not universally supported.
 */
function srtToVtt(srt: string): string {
  const lines = srt.trim().split(/\r?\n/);
  const out: string[] = ["WEBVTT", ""];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    // Skip optional SRT index line (digits only)
    if (/^\d+$/.test(line.trim())) {
      i++;
      if (i >= lines.length) break;
    }
    const timeLine = lines[i];
    // SRT timestamp: 00:00:10,196 --> 00:02:10,893  →  VTT: 00:00:10.196 --> 00:02:10.893
    if (timeLine && /^\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/.test(timeLine)) {
      out.push(timeLine.replace(/,/g, "."));
      i++;
      while (i < lines.length && lines[i].trim() !== "") {
        out.push(lines[i]);
        i++;
      }
      out.push("");
    }
    i++;
  }

  return out.join("\n");
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (e) {
    console.error("[vtt] fetch error", e);
    return NextResponse.json({ error: "Failed to fetch subtitle file" }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: `Subtitle URL returned ${res.status}` },
      { status: 502 }
    );
  }

  const text = await res.text();
  const vtt = srtToVtt(text);

  return new NextResponse(vtt, {
    headers: {
      "Content-Type": "text/vtt; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
