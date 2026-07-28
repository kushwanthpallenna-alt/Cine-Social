import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SECRET_KEY || ""
);

// GET /api/user-search?q=searchterm
// Searches profiles by display_name or username (case-insensitive)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("user_id, display_name, username, avatar_url")
    .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
    .limit(15);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: data || [] });
}
