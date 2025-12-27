import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: Request) {
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: "Supabase credentials missing" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing bearer token" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json(
      { ok: false, error: userError?.message || "Invalid token" },
      { status: 401 }
    );
  }

  const email = userData.user.email;
  if (!email) {
    return NextResponse.json({ ok: false, error: "No email on account" }, { status: 403 });
  }

  const { data: allowed, error: dbError } = await supabase
    .from("allowed_emails")
    .select("email")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (dbError) {
    return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 });
  }

  if (!allowed) {
    return NextResponse.json({ ok: false, error: "Email not allowed" }, { status: 403 });
  }

  return NextResponse.json({ ok: true, email });
}

