import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SECRET_KEY || ""
);

// GET /api/user-profile?userId=X  OR  ?username=X
// Returns public profile data for any user (used for public profiles page)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const username = searchParams.get("username");

  if (!userId && !username) {
    return NextResponse.json({ error: "Missing userId or username" }, { status: 400 });
  }

  let query = supabaseAdmin
    .from("profiles")
    .select("user_id, username, display_name, avatar_url, bio, updated_at");

  if (userId) {
    query = query.eq("user_id", userId);
  } else {
    query = query.eq("username", username!.toLowerCase());
  }

  const { data, error } = await query.maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Strip sensitive fields
  return NextResponse.json({
    user_id: data.user_id,
    username: data.username,
    display_name: data.display_name,
    avatar_url: data.avatar_url,
    bio: data.bio ?? null,
  });
}
