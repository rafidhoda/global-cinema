import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TABLE = "watch_progress";

export async function GET(req: Request) {
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const movieSlug = searchParams.get("movieSlug")?.trim();
  const viewerId = searchParams.get("viewerId")?.trim();

  if (!movieSlug || !viewerId) {
    return NextResponse.json(
      { error: "movieSlug and viewerId are required" },
      { status: 400 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data, error } = await supabase
    .from(TABLE)
    .select("position_seconds")
    .eq("viewer_id", viewerId)
    .eq("movie_slug", movieSlug)
    .maybeSingle();

  if (error) {
    console.error("[watch-progress] get error", error);
    return NextResponse.json(
      { error: error.message },
      { status: 502 }
    );
  }

  const positionSeconds =
    data?.position_seconds != null ? Number(data.position_seconds) : 0;
  return NextResponse.json({ positionSeconds });
}

export async function POST(req: Request) {
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  let body: { movieSlug?: string; viewerId?: string; positionSeconds?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const movieSlug = typeof body.movieSlug === "string" ? body.movieSlug.trim() : "";
  const viewerId = typeof body.viewerId === "string" ? body.viewerId.trim() : "";
  const positionSeconds =
    typeof body.positionSeconds === "number" && body.positionSeconds >= 0
      ? body.positionSeconds
      : 0;

  if (!movieSlug || !viewerId) {
    return NextResponse.json(
      { error: "movieSlug and viewerId are required" },
      { status: 400 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { error } = await supabase.from(TABLE).upsert(
    {
      viewer_id: viewerId,
      movie_slug: movieSlug,
      position_seconds: positionSeconds,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "viewer_id,movie_slug",
    }
  );

  if (error) {
    console.error("[watch-progress] upsert error", error);
    return NextResponse.json(
      { error: error.message },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
