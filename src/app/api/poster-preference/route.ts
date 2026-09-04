import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/*
  SQL Migration to create or update the user_poster_preferences table in Supabase:

  CREATE TABLE IF NOT EXISTS public.user_poster_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    movie_id TEXT NOT NULL,
    poster_path TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'movie',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT user_poster_preferences_user_media_unique UNIQUE (user_id, movie_id, content_type)
  );

  -- Index for fast user lookups
  CREATE INDEX IF NOT EXISTS idx_user_poster_preferences_lookup 
  ON public.user_poster_preferences (user_id, movie_id, content_type);
*/

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseSecret = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseSecret);

// GET /api/poster-preference?userId=&movieId=&contentType=
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const movieId = searchParams.get("movieId");
  const contentType = searchParams.get("contentType") || "movie";

  if (!userId || !movieId) {
    return NextResponse.json({ error: "Missing userId or movieId" }, { status: 400 });
  }

  // 1. Check user_poster_preferences (if table exists)
  try {
    const { data, error } = await supabaseAdmin
      .from("user_poster_preferences")
      .select("poster_path")
      .eq("user_id", userId)
      .eq("movie_id", movieId)
      .eq("content_type", contentType)
      .maybeSingle();

    if (!error && data?.poster_path) {
      return NextResponse.json({ poster_path: data.poster_path });
    }
  } catch (e) {
    // If column content_type doesn't exist yet, try basic lookup
    try {
      const { data } = await supabaseAdmin
        .from("user_poster_preferences")
        .select("poster_path")
        .eq("user_id", userId)
        .eq("movie_id", movieId)
        .maybeSingle();
      if (data?.poster_path) {
        return NextResponse.json({ poster_path: data.poster_path });
      }
    } catch {}
  }

  // 2. Fallback: check watched table with content_type matching
  try {
    let watchedQuery = supabaseAdmin
      .from("watched")
      .select("poster_path")
      .eq("user_id", userId)
      .eq("movie_id", movieId);

    if (contentType === "tv") {
      watchedQuery = watchedQuery.eq("content_type", "tv");
    } else {
      watchedQuery = watchedQuery.or("content_type.eq.movie,content_type.is.null");
    }

    const { data: watchedData } = await watchedQuery.maybeSingle();

    if (watchedData?.poster_path) {
      return NextResponse.json({ poster_path: watchedData.poster_path });
    }
  } catch (e) {}

  // 3. Fallback: check watchlist table with content_type matching
  try {
    let watchlistQuery = supabaseAdmin
      .from("watchlist")
      .select("poster_path")
      .eq("user_id", userId)
      .eq("movie_id", movieId);

    if (contentType === "tv") {
      watchlistQuery = watchlistQuery.eq("content_type", "tv");
    } else {
      watchlistQuery = watchlistQuery.or("content_type.eq.movie,content_type.is.null");
    }

    const { data: watchlistData } = await watchlistQuery.maybeSingle();

    if (watchlistData?.poster_path) {
      return NextResponse.json({ poster_path: watchlistData.poster_path });
    }
  } catch (e) {}

  return NextResponse.json(null);
}

// POST /api/poster-preference  { user_id, movie_id, poster_path, content_type }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, movie_id, poster_path, content_type = "movie" } = body;

    if (!user_id || !movie_id || !poster_path) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Try upserting into user_poster_preferences
    try {
      await supabaseAdmin
        .from("user_poster_preferences")
        .upsert(
          { user_id, movie_id, poster_path, content_type },
          { onConflict: "user_id,movie_id,content_type" }
        );
    } catch (e) {
      try {
        await supabaseAdmin
          .from("user_poster_preferences")
          .upsert({ user_id, movie_id, poster_path }, { onConflict: "user_id,movie_id" });
      } catch {}
    }

    // 2. Update poster_path in watchlist table if item exists for this content_type
    try {
      let wlQuery = supabaseAdmin
        .from("watchlist")
        .update({ poster_path })
        .eq("user_id", user_id)
        .eq("movie_id", movie_id);

      if (content_type === "tv") {
        wlQuery = wlQuery.eq("content_type", "tv");
      } else {
        wlQuery = wlQuery.or("content_type.eq.movie,content_type.is.null");
      }

      await wlQuery;
    } catch (e) {}

    // 3. Update poster_path in watched table if item exists for this content_type
    try {
      let wQuery = supabaseAdmin
        .from("watched")
        .update({ poster_path })
        .eq("user_id", user_id)
        .eq("movie_id", movie_id);

      if (content_type === "tv") {
        wQuery = wQuery.eq("content_type", "tv");
      } else {
        wQuery = wQuery.or("content_type.eq.movie,content_type.is.null");
      }

      await wQuery;
    } catch (e) {}

    return NextResponse.json({ success: true, poster_path });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/poster-preference?userId=&movieId=&contentType=&defaultPosterPath=
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const movieId = searchParams.get("movieId");
  const contentType = searchParams.get("contentType") || "movie";
  const defaultPosterPath = searchParams.get("defaultPosterPath") || "";

  if (!userId || !movieId) {
    return NextResponse.json({ error: "Missing userId or movieId" }, { status: 400 });
  }

  // 1. Delete from user_poster_preferences
  try {
    let delQuery = supabaseAdmin
      .from("user_poster_preferences")
      .delete()
      .eq("user_id", userId)
      .eq("movie_id", movieId);

    if (contentType === "tv") {
      delQuery = delQuery.eq("content_type", "tv");
    }

    await delQuery;
  } catch (e) {}

  // 2. Reset watchlist/watched tables to defaultPosterPath if provided
  if (defaultPosterPath) {
    try {
      let wlReset = supabaseAdmin
        .from("watchlist")
        .update({ poster_path: defaultPosterPath })
        .eq("user_id", userId)
        .eq("movie_id", movieId);

      if (contentType === "tv") {
        wlReset = wlReset.eq("content_type", "tv");
      } else {
        wlReset = wlReset.or("content_type.eq.movie,content_type.is.null");
      }

      await wlReset;
    } catch (e) {}

    try {
      let wReset = supabaseAdmin
        .from("watched")
        .update({ poster_path: defaultPosterPath })
        .eq("user_id", userId)
        .eq("movie_id", movieId);

      if (contentType === "tv") {
        wReset = wReset.eq("content_type", "tv");
      } else {
        wReset = wReset.or("content_type.eq.movie,content_type.is.null");
      }

      await wReset;
    } catch (e) {}
  }

  return NextResponse.json({ success: true });
}

