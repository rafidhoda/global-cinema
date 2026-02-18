/**
 * One-off migration: move created subtitle files from
 *   movie-of-the-week/{movieSlug}-{langSlug}.srt
 * to
 *   by-movie/{movieSlug}/{langSlug}.srt
 *
 * Run from project root with env loaded:
 *   node --env-file=.env.local scripts/migrate-movie-storage.js
 *
 * Or: SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... node scripts/migrate-movie-storage.js
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const bucket = process.env.SUPABASE_MOVIES_BUCKET || "movies";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const OLD_PREFIX = "movie-of-the-week/";
const NEW_PREFIX = "by-movie/";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eq = trimmed.indexOf("=");
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim();
        if (!process.env[key]) process.env[key] = value;
      }
    }
  });
}

loadEnvLocal();

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

/**
 * Parse old filename "taare-zameen-par-2007-polish.srt" -> { movieSlug, langSlug }
 * We take the last hyphen before .srt as the split (lang is one word).
 */
function parseOldName(name) {
  if (!name.endsWith(".srt")) return null;
  const base = name.slice(0, -4);
  const lastHyphen = base.lastIndexOf("-");
  if (lastHyphen <= 0) return null;
  return {
    movieSlug: base.slice(0, lastHyphen),
    langSlug: base.slice(lastHyphen + 1),
  };
}

async function main() {
  console.log("Listing files in", OLD_PREFIX, "...");
  const { data: files, error: listError } = await supabase.storage
    .from(bucket)
    .list("movie-of-the-week", { limit: 100 });

  if (listError) {
    console.error("List error:", listError.message);
    process.exit(1);
  }

  const toMigrate = [];
  for (const file of files || []) {
    if (file.name?.startsWith(".")) continue;
    const parsed = parseOldName(file.name);
    if (parsed) toMigrate.push({ name: file.name, ...parsed });
  }

  if (toMigrate.length === 0) {
    console.log("No subtitle files to migrate in movie-of-the-week/");
    return;
  }

  console.log("Found", toMigrate.length, "file(s) to migrate:");
  toMigrate.forEach(({ name, movieSlug, langSlug }) => {
    console.log("  ", name, "->", `${NEW_PREFIX}${movieSlug}/${langSlug}.srt`);
  });

  for (const { name, movieSlug, langSlug } of toMigrate) {
    const oldPath = `${OLD_PREFIX}${name}`;
    const newPath = `${NEW_PREFIX}${movieSlug}/${langSlug}.srt`;

    const { data: blob, error: downError } = await supabase.storage
      .from(bucket)
      .download(oldPath);

    if (downError || !blob) {
      console.error("Download failed", oldPath, downError?.message);
      continue;
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const { error: upError } = await supabase.storage.from(bucket).upload(newPath, buffer, {
      contentType: "application/x-subrip",
      upsert: true,
    });

    if (upError) {
      console.error("Upload failed", newPath, upError.message);
      continue;
    }

    console.log("OK", name, "->", newPath);
  }

  console.log("\nDone. Old files in movie-of-the-week/ were left in place.");
  console.log("You can delete them manually in Supabase Dashboard if you want.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
