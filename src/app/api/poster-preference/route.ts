import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseSecret = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseSecret);

// GET /api/poster-preference?userId=&movieId=
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const movieId = searchParams.get("movieId");

  if (!userId || !movieId) {
    return NextResponse.json({ error: "Missing userId or movieId" }, { status: 400 });
  }

  // 1. Check user_poster_preferences
  try {
    const { data, error } = await supabaseAdmin
      .from("user_poster_preferences")
      .select("poster_path")
      .eq("user_id", userId)
      .eq("movie_id", movieId)
      .maybeSingle();

    if (!error && data?.poster_path) {
      return NextResponse.json({ poster_path: data.poster_path });
    }
  } catch (e) {}

  // 2. Fallback: check watched table
  try {
    const { data: watchedData } = await supabaseAdmin
      .from("watched")
      .select("poster_path")
      .eq("user_id", userId)
      .eq("movie_id", movieId)
      .maybeSingle();

    if (watchedData?.poster_path) {
      return NextResponse.json({ poster_path: watchedData.poster_path });
    }
  } catch (e) {}

  // 3. Fallback: check watchlist table
  try {
    const { data: watchlistData } = await supabaseAdmin
      .from("watchlist")
      .select("poster_path")
      .eq("user_id", userId)
      .eq("movie_id", movieId)
      .maybeSingle();

    if (watchlistData?.poster_path) {
      return NextResponse.json({ poster_path: watchlistData.poster_path });
    }
  } catch (e) {}

  return NextResponse.json(null);
}

// POST /api/poster-preference  { user_id, movie_id, poster_path }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, movie_id, poster_path } = body;

    if (!user_id || !movie_id || !poster_path) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Try upserting into user_poster_preferences
    try {
      await supabaseAdmin
        .from("user_poster_preferences")
        .upsert({ user_id, movie_id, poster_path }, { onConflict: "user_id,movie_id" });
    } catch (e) {}

    // 2. Update poster_path in watchlist table if item exists
    try {
      await supabaseAdmin
        .from("watchlist")
        .update({ poster_path })
        .eq("user_id", user_id)
        .eq("movie_id", movie_id);
    } catch (e) {}

    // 3. Update poster_path in watched table if item exists
    try {
      await supabaseAdmin
        .from("watched")
        .update({ poster_path })
        .eq("user_id", user_id)
        .eq("movie_id", movie_id);
    } catch (e) {}

    return NextResponse.json({ success: true, poster_path });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/poster-preference?userId=&movieId=&defaultPosterPath=
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const movieId = searchParams.get("movieId");
  const defaultPosterPath = searchParams.get("defaultPosterPath") || "";

  if (!userId || !movieId) {
    return NextResponse.json({ error: "Missing userId or movieId" }, { status: 400 });
  }

  // 1. Delete from user_poster_preferences
  try {
    await supabaseAdmin
      .from("user_poster_preferences")
      .delete()
      .eq("user_id", userId)
      .eq("movie_id", movieId);
  } catch (e) {}

  // 2. Reset watchlist/watched tables to defaultPosterPath if provided
  if (defaultPosterPath) {
    try {
      await supabaseAdmin
        .from("watchlist")
        .update({ poster_path: defaultPosterPath })
        .eq("user_id", userId)
        .eq("movie_id", movieId);
    } catch (e) {}

    try {
      await supabaseAdmin
        .from("watched")
        .update({ poster_path: defaultPosterPath })
        .eq("user_id", userId)
        .eq("movie_id", movieId);
    } catch (e) {}
  }

  return NextResponse.json({ success: true });
}
