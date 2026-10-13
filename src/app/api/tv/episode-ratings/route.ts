import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SECRET_KEY || ""
);

// GET /api/tv/episode-ratings?userId=X&showId=Y[&season=Z]
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const showId = searchParams.get("showId");
  const season = searchParams.get("season");

  if (!userId || !showId) {
    return NextResponse.json({ error: "Missing userId or showId" }, { status: 400 });
  }

  let query = supabaseAdmin
    .from("episode_ratings")
    .select("*")
    .eq("user_id", userId)
    .eq("show_id", showId);

  if (season) {
    query = query.eq("season", parseInt(season, 10));
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST /api/tv/episode-ratings
// Upserts a single episode rating
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, show_id, season, episode, rating } = body;

    if (!user_id || !show_id || season == null || episode == null || rating == null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("episode_ratings")
      .upsert(
        {
          user_id,
          show_id: String(show_id),
          season: parseInt(season, 10),
          episode: parseInt(episode, 10),
          rating: parseFloat(rating),
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id,show_id,season,episode" }
      )
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/tv/episode-ratings?userId=X&showId=Y&season=Z&episode=E
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const showId = searchParams.get("showId");
  const season = searchParams.get("season");
  const episode = searchParams.get("episode");

  if (!userId || !showId || !season || !episode) {
    return NextResponse.json({ error: "Missing required params" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("episode_ratings")
    .delete()
    .eq("user_id", userId)
    .eq("show_id", showId)
    .eq("season", parseInt(season, 10))
    .eq("episode", parseInt(episode, 10));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
