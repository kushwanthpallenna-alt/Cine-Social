import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseSecret = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseSecret);

// GET /api/watchlist-export?userId=
// Returns a CSV file of the user's watchlist
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("watchlist")
    .select("movie_id, movie_title, poster_path, content_type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data || [];

  // Build CSV (Letterboxd-compatible columns + extras)
  const header = "Date,Name,Year,TMDB_ID,Content_Type,Letterboxd_URI";
  const csvLines = rows.map((item: any) => {
    const date = item.created_at ? item.created_at.slice(0, 10) : "";
    const name = `"${(item.movie_title || "").replace(/"/g, '""')}"`;
    const year = ""; // We don't store year; can be blank
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
