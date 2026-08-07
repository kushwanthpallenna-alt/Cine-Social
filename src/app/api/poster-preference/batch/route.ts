import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseSecret = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseSecret);

// POST /api/poster-preference/batch
// Body: { user_id: string, movie_ids: string[] }
// Returns: { movie_id: string, poster_path: string }[]
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, movie_ids } = body;

    if (!user_id || !Array.isArray(movie_ids) || movie_ids.length === 0) {
      return NextResponse.json([]);
    }

    const resultMap: Record<string, string> = {};

    // 1. Fetch from user_poster_preferences
    try {
      const { data } = await supabaseAdmin
        .from("user_poster_preferences")
        .select("movie_id, poster_path")
        .eq("user_id", user_id)
        .in("movie_id", movie_ids);

      if (data) {
        data.forEach((p) => {
          if (p.movie_id && p.poster_path) resultMap[p.movie_id] = p.poster_path;
        });
      }
    } catch (e) {}

    // 2. Fetch from watched table for any missing movie_ids
    const missingInWatched = movie_ids.filter((id) => !resultMap[id]);
    if (missingInWatched.length > 0) {
      try {
        const { data: watchedData } = await supabaseAdmin
          .from("watched")
          .select("movie_id, poster_path")
          .eq("user_id", user_id)
          .in("movie_id", missingInWatched);

        if (watchedData) {
          watchedData.forEach((w) => {
            if (w.movie_id && w.poster_path && !resultMap[w.movie_id]) {
              resultMap[w.movie_id] = w.poster_path;
            }
          });
        }
      } catch (e) {}
    }

    // 3. Fetch from watchlist table for any missing movie_ids
    const missingInWatchlist = movie_ids.filter((id) => !resultMap[id]);
    if (missingInWatchlist.length > 0) {
      try {
        const { data: watchlistData } = await supabaseAdmin
          .from("watchlist")
          .select("movie_id, poster_path")
          .eq("user_id", user_id)
          .in("movie_id", missingInWatchlist);

        if (watchlistData) {
          watchlistData.forEach((wl) => {
            if (wl.movie_id && wl.poster_path && !resultMap[wl.movie_id]) {
              resultMap[wl.movie_id] = wl.poster_path;
            }
          });
        }
      } catch (e) {}
    }

    const result = Object.entries(resultMap).map(([movie_id, poster_path]) => ({
      movie_id,
      poster_path,
    }));

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
