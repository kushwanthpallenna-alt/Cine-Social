import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SECRET_KEY || ""
);

// GET /api/watch-log?userId=X&contentId=Y&contentType=movie
// Returns all watch_log entries for a user+content combo (to get rewatch count)
// Or if just userId, returns all entries
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const contentId = searchParams.get("contentId");
  const contentType = searchParams.get("contentType") || "movie";

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  let query = supabaseAdmin
    .from("watch_log")
    .select("*")
    .eq("user_id", userId)
    .order("watched_at", { ascending: false });

  if (contentId) {
    query = query.eq("content_id", contentId).eq("content_type", contentType);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data || []);
}

// POST /api/watch-log
// Creates a new watch_log entry (for rewatches or initial log)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      user_id,
      content_id,
      content_type = "movie",
      title,
      poster_path,
      watched_at,
      rating,
      review,
      is_rewatch = false,
    } = body;

    if (!user_id || !content_id) {
      return NextResponse.json({ error: "Missing user_id or content_id" }, { status: 400 });
    }

    const entry = {
      user_id,
      content_id: String(content_id),
      content_type,
      title: title || null,
      poster_path: poster_path || null,
      watched_at: watched_at ? new Date(watched_at).toISOString() : new Date().toISOString(),
      rating: rating || null,
      review: review || null,
      is_rewatch,
    };

    const { data, error } = await supabaseAdmin
      .from("watch_log")
      .insert(entry)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
