import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseSecret = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseSecret);

// POST /api/poster-preference/batch
// Body: { user_id: string, items?: { movie_id: string; content_type?: string }[], movie_ids?: string[] }
// Returns: { movie_id: string; content_type?: string; poster_path: string }[]
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, items, movie_ids } = body;

    if (!user_id) {
      return NextResponse.json([]);
    }

    // Normalize target media items
    let normalizedItems: { movie_id: string; content_type: string }[] = [];
    if (Array.isArray(items) && items.length > 0) {
      normalizedItems = items.map((it: any) => ({
        movie_id: String(it.movie_id),
        content_type: it.content_type === "tv" ? "tv" : "movie",
      }));
    } else if (Array.isArray(movie_ids) && movie_ids.length > 0) {
      normalizedItems = movie_ids.map((id: any) => ({
        movie_id: String(id),
        content_type: "movie",
      }));
    }

    if (normalizedItems.length === 0) {
      return NextResponse.json([]);
    }

    const resultMap: Record<string, string> = {};
    const allIds = Array.from(new Set(normalizedItems.map(i => i.movie_id)));

    // 1. Fetch from user_poster_preferences
    try {
      const { data } = await supabaseAdmin
        .from("user_poster_preferences")
        .select("movie_id, poster_path, content_type")
        .eq("user_id", user_id)
        .in("movie_id", allIds);

      if (data) {
        data.forEach((p) => {
          if (p.movie_id && p.poster_path) {
            const type = p.content_type || "movie";
            resultMap[`${type}_${p.movie_id}`] = p.poster_path;
            if (!resultMap[p.movie_id]) resultMap[p.movie_id] = p.poster_path;
          }
        });
      }
    } catch (e) {}

    // 2. Fetch from watched table for any missing media
    const missingInWatched = normalizedItems.filter(
      (item) => !resultMap[`${item.content_type}_${item.movie_id}`] && !resultMap[item.movie_id]
    );

    if (missingInWatched.length > 0) {
      try {
        const missingIds = Array.from(new Set(missingInWatched.map(i => i.movie_id)));
        const { data: watchedData } = await supabaseAdmin
          .from("watched")
          .select("movie_id, poster_path, content_type")
          .eq("user_id", user_id)
          .in("movie_id", missingIds);

        if (watchedData) {
          watchedData.forEach((w) => {
            if (w.movie_id && w.poster_path) {
              const type = w.content_type || "movie";
              if (!resultMap[`${type}_${w.movie_id}`]) {
                resultMap[`${type}_${w.movie_id}`] = w.poster_path;
              }
              if (!resultMap[w.movie_id]) {
                resultMap[w.movie_id] = w.poster_path;
              }
            }
          });
        }
      } catch (e) {}
    }

    // 3. Fetch from watchlist table for any still missing media
    const missingInWatchlist = normalizedItems.filter(
      (item) => !resultMap[`${item.content_type}_${item.movie_id}`] && !resultMap[item.movie_id]
    );

    if (missingInWatchlist.length > 0) {
      try {
        const missingIds = Array.from(new Set(missingInWatchlist.map(i => i.movie_id)));
        const { data: watchlistData } = await supabaseAdmin
          .from("watchlist")
          .select("movie_id, poster_path, content_type")
          .eq("user_id", user_id)
          .in("movie_id", missingIds);

        if (watchlistData) {
          watchlistData.forEach((wl) => {
            if (wl.movie_id && wl.poster_path) {
              const type = wl.content_type || "movie";
              if (!resultMap[`${type}_${wl.movie_id}`]) {
                resultMap[`${type}_${wl.movie_id}`] = wl.poster_path;
              }
              if (!resultMap[wl.movie_id]) {
                resultMap[wl.movie_id] = wl.poster_path;
              }
            }
          });
        }
      } catch (e) {}
    }

    const result = normalizedItems.map(({ movie_id, content_type }) => ({
      movie_id,
      content_type,
      poster_path: resultMap[`${content_type}_${movie_id}`] || resultMap[movie_id] || "",
    })).filter(r => !!r.poster_path);

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

