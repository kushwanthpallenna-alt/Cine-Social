import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseSecret = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseSecret);

function escapeCsvField(val: any): string {
  if (val == null) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// GET /api/watchlist-export?userId=&type=watchlist|ratings|reviews|all
// Exports user's data as Letterboxd / CineSocial compatible CSV
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const exportType = (searchParams.get("type") || "watchlist").toLowerCase();

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  // Pre-fetch title cache from watched & watchlist
  const [watchedRes, watchlistRes] = await Promise.all([
    supabaseAdmin.from("watched").select("movie_id, movie_title, content_type").eq("user_id", userId),
    supabaseAdmin.from("watchlist").select("movie_id, movie_title, content_type").eq("user_id", userId),
  ]);

  const titleMap = new Map<string, string>();
  (watchedRes.data || []).forEach((item: any) => {
    if (item.movie_id && item.movie_title) titleMap.set(String(item.movie_id), item.movie_title);
  });
  (watchlistRes.data || []).forEach((item: any) => {
    if (item.movie_id && item.movie_title && !titleMap.has(String(item.movie_id))) {
      titleMap.set(String(item.movie_id), item.movie_title);
    }
  });

  if (exportType === "ratings") {
    const { data, error } = await supabaseAdmin
      .from("ratings")
      .select("movie_id, rating, content_type, liked, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = data || [];
    const header = "Date,Name,Year,TMDB_ID,Content_Type,Rating,Liked,Letterboxd_URI";
    const csvLines = rows.map((item: any) => {
      const date = item.created_at ? item.created_at.slice(0, 10) : "";
      const tmdbId = item.movie_id || "";
      const name = escapeCsvField(titleMap.get(String(tmdbId)) || `Title ${tmdbId}`);
      const year = "";
      const contentType = item.content_type || "movie";
      const rating = item.rating != null ? item.rating : "";
      const liked = item.liked ? "true" : "false";
      const uri = `https://www.themoviedb.org/${contentType}/${tmdbId}`;
      return [date, name, year, tmdbId, contentType, rating, liked, uri].join(",");
    });

    const csv = [header, ...csvLines].join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cinesocial-ratings.csv"`,
      },
    });
  }

  if (exportType === "reviews") {
    const [reviewsRes, ratingsRes] = await Promise.all([
      supabaseAdmin
        .from("reviews")
        .select("movie_id, review_text, content_type, created_at, user_name")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("ratings")
        .select("movie_id, rating")
        .eq("user_id", userId),
    ]);

    if (reviewsRes.error) return NextResponse.json({ error: reviewsRes.error.message }, { status: 500 });

    const ratingMap = new Map<string, number>();
    (ratingsRes.data || []).forEach((r: any) => {
      if (r.movie_id) ratingMap.set(String(r.movie_id), r.rating);
    });

    const rows = reviewsRes.data || [];
    const header = "Date,Name,Year,TMDB_ID,Content_Type,Rating,Review,Letterboxd_URI";
    const csvLines = rows.map((item: any) => {
      const date = item.created_at ? item.created_at.slice(0, 10) : "";
      const tmdbId = item.movie_id || "";
      const name = escapeCsvField(titleMap.get(String(tmdbId)) || `Title ${tmdbId}`);
      const year = "";
      const contentType = item.content_type || "movie";
      const rating = ratingMap.get(String(tmdbId)) ?? "";
      const review = escapeCsvField(item.review_text || "");
      const uri = `https://www.themoviedb.org/${contentType}/${tmdbId}`;
      return [date, name, year, tmdbId, contentType, rating, review, uri].join(",");
    });

    const csv = [header, ...csvLines].join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cinesocial-reviews.csv"`,
      },
    });
  }

  if (exportType === "all") {
    const [ratingsRes, reviewsRes] = await Promise.all([
      supabaseAdmin.from("ratings").select("movie_id, rating, content_type, liked, created_at").eq("user_id", userId),
      supabaseAdmin.from("reviews").select("movie_id, review_text, content_type, created_at").eq("user_id", userId),
    ]);

    const ratingMap = new Map<string, any>();
    (ratingsRes.data || []).forEach((r: any) => {
      ratingMap.set(String(r.movie_id), r);
    });

    const reviewMap = new Map<string, string>();
    (reviewsRes.data || []).forEach((rv: any) => {
      reviewMap.set(String(rv.movie_id), rv.review_text);
    });

    const watchlistRows = watchlistRes.data || [];
    const watchedRows = watchedRes.data || [];

    // Collect all unique movie IDs
    const allKeys = new Set<string>();
    watchlistRows.forEach((w: any) => allKeys.add(String(w.movie_id)));
    watchedRows.forEach((w: any) => allKeys.add(String(w.movie_id)));
    ratingMap.forEach((_, k) => allKeys.add(k));
    reviewMap.forEach((_, k) => allKeys.add(k));

    const header = "Date,Name,TMDB_ID,Content_Type,Rating,Liked,In_Watchlist,In_Watched,Review,Letterboxd_URI";
    const csvLines = Array.from(allKeys).map((tmdbId) => {
      const inWatchlist = watchlistRows.some((w: any) => String(w.movie_id) === tmdbId);
      const inWatched = watchedRows.some((w: any) => String(w.movie_id) === tmdbId);
      const ratingObj = ratingMap.get(tmdbId);
      const reviewText = reviewMap.get(tmdbId) || "";
      const name = escapeCsvField(titleMap.get(tmdbId) || `Title ${tmdbId}`);
      const contentType = ratingObj?.content_type || "movie";
      const date = (ratingObj?.created_at || new Date().toISOString()).slice(0, 10);
      const rating = ratingObj?.rating ?? "";
      const liked = ratingObj?.liked ? "true" : "false";
      const uri = `https://www.themoviedb.org/${contentType}/${tmdbId}`;

      return [
        date,
        name,
        tmdbId,
        contentType,
        rating,
        liked,
        inWatchlist ? "true" : "false",
        inWatched ? "true" : "false",
        escapeCsvField(reviewText),
        uri,
      ].join(",");
    });

    const csv = [header, ...csvLines].join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cinesocial-complete-backup.csv"`,
      },
    });
  }

  // Default: Watchlist export
  const rows = watchlistRes.data || [];
  const header = "Date,Name,Year,TMDB_ID,Content_Type,Letterboxd_URI";
  const csvLines = rows.map((item: any) => {
    const date = item.created_at ? item.created_at.slice(0, 10) : "";
    const name = escapeCsvField(item.movie_title || "");
    const year = "";
    const tmdbId = item.movie_id || "";
    const contentType = item.content_type || "movie";
    const uri = `https://www.themoviedb.org/${contentType}/${tmdbId}`;
    return [date, name, year, tmdbId, contentType, uri].join(",");
  });

  const csv = [header, ...csvLines].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cinesocial-watchlist.csv"`,
    },
  });
}
