import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SECRET_KEY || ""
);

// GET /api/taste-match?userA=X&userB=Y
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userA = searchParams.get("userA");
  const userB = searchParams.get("userB");

  if (!userA || !userB) {
    return NextResponse.json({ error: "Missing userA or userB" }, { status: 400 });
  }

  const [resA, resB] = await Promise.all([
    supabaseAdmin.from("ratings").select("movie_id, rating").eq("user_id", userA),
    supabaseAdmin.from("ratings").select("movie_id, rating").eq("user_id", userB),
  ]);

  if (resA.error || resB.error) {
    return NextResponse.json({ error: "Failed to fetch ratings" }, { status: 500 });
  }

  const ratingsA = resA.data || [];
  const ratingsB = resB.data || [];

  const mapA = new Map<string, number>(ratingsA.map((r) => [r.movie_id, r.rating]));
  const mapB = new Map<string, number>(ratingsB.map((r) => [r.movie_id, r.rating]));

  // Find overlap
  const sharedMovies: { movieId: string; ratingA: number; ratingB: number }[] = [];
  for (const [movieId, ratingA] of mapA.entries()) {
    if (mapB.has(movieId)) {
      sharedMovies.push({ movieId, ratingA, ratingB: mapB.get(movieId)! });
    }
  }

  if (sharedMovies.length === 0) {
    return NextResponse.json({ noOverlap: true, sharedCount: 0 });
  }

  // Ratings are integers 1–10 (or 1–5 stars * 2 — we treat whatever scale is in DB)
  // Max possible diff per rating pair
  const maxDiff = 9; // assuming 1–10 scale
  const avgAbsDiff =
    sharedMovies.reduce((sum, { ratingA, ratingB }) => sum + Math.abs(ratingA - ratingB), 0) /
    sharedMovies.length;

  const percentage = Math.round(Math.max(0, (1 - avgAbsDiff / maxDiff) * 100));

  let label: string;
  if (percentage >= 90) label = "Kindred Cinephiles";
  else if (percentage >= 75) label = "Taste Twins";
  else if (percentage >= 55) label = "Aligned Viewers";
  else if (percentage >= 30) label = "Different Wavelengths";
  else label = "Polar Opposites";

  return NextResponse.json({ percentage, label, sharedCount: sharedMovies.length });
}
