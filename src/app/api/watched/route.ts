import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseSecret = process.env.SUPABASE_SECRET_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseSecret);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const movieId = searchParams.get("movieId");
  const contentType = searchParams.get("contentType") || "movie";

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  let query = supabaseAdmin.from("watched").select("*").eq("user_id", userId);
  if (movieId) {
    query = query.eq("movie_id", movieId).eq("content_type", contentType);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  if (movieId) {
    return NextResponse.json(data.length > 0 ? data[0] : null);
  }
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, movie_id, movie_title, poster_path, content_type = "movie" } = body;

    if (!user_id || !movie_id) {
      return NextResponse.json({ error: "Missing user_id or movie_id" }, { status: 400 });
    }

    const movieIdStr = String(movie_id);

    // Check if an entry already exists for this user, content, and item
    const { data: existing } = await supabaseAdmin
      .from("watched")
      .select("*")
      .eq("user_id", user_id)
      .eq("movie_id", movieIdStr)
      .eq("content_type", content_type)
      .maybeSingle();

    if (existing) {
      // Update existing entry
      const { data, error } = await supabaseAdmin
        .from("watched")
        .update({
          movie_title: movie_title || existing.movie_title,
          poster_path: poster_path || existing.poster_path,
          watched_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data && data.length > 0 ? data[0] : existing);
    }

    // Insert new entry
    const { data, error } = await supabaseAdmin.from("watched").insert({
      user_id,
      movie_id: movieIdStr,
      movie_title,
      poster_path,
      content_type,
      watched_at: new Date().toISOString()
    }).select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data && data.length > 0 ? data[0] : null);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const movieId = searchParams.get("movieId");
  const contentType = searchParams.get("contentType") || "movie";

  if (!userId || !movieId) {
    return NextResponse.json({ error: "Missing userId or movieId" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("watched")
    .delete()
    .eq("user_id", userId)
    .eq("movie_id", movieId)
    .eq("content_type", contentType);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
