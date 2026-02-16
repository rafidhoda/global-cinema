/**
 * Parse SRT time string "00:01:23,456" to seconds.
 */
export function parseSrtTime(value: string): number {
  const [hms, ms] = value.split(",");
  if (!hms || ms === undefined) return 0;
  const [h, m, s] = hms.split(":").map(Number);
  return h * 3600 + m * 60 + s + Number(ms) / 1000;
}

export type SrtCue = { start: number; end: number; text: string };

/**
 * Parse SRT content into cues with start, end, text.
 */
export function parseSrt(srt: string): SrtCue[] {
  if (!srt.trim()) return [];
  const blocks = srt.replace(/\r\n/g, "\n").split(/\n\n+/);
  const cues: SrtCue[] = [];
  for (const block of blocks) {
    const rawLines = block.split("\n").filter((l) => l.trim().length > 0);
    if (rawLines.length < 2) continue;

    let timingLineIndex = 0;
    if (/^\d+$/.test(rawLines[0]) && rawLines.length >= 2) {
      timingLineIndex = 1;
    }
    const timing = rawLines[timingLineIndex]?.match(
      /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/
    );
    if (!timing) continue;

    const textStartIndex = timingLineIndex + 1;
    const text = rawLines.slice(textStartIndex).join("\n");
    const start = parseSrtTime(timing[1]);
    const end = parseSrtTime(timing[2]);
    cues.push({ start, end, text });
  }
  return cues;
}
