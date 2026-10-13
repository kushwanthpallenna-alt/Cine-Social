import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SECRET_KEY || ""
);

// GET /api/tv/season-reviews?showId=Y[&season=Z]
// Returns season reviews for a show, optionally filtered by season
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const showId = searchParams.get("showId");
  const season = searchParams.get("season");

  if (!showId) {
    return NextResponse.json({ error: "Missing showId" }, { status: 400 });
  }

  let query = supabaseAdmin
    .from("season_reviews")
    .select("*")
    .eq("show_id", showId)
    .order("created_at", { ascending: false });

  if (season) {
    query = query.eq("season", parseInt(season, 10));
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST /api/tv/season-reviews
// Creates a new season review
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, user_name, user_avatar, show_id, season, review_text, rating } = body;

    if (!user_id || !show_id || season == null || !review_text?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("season_reviews")
      .insert({
        user_id,
        user_name: user_name || "Cine Member",
        user_avatar: user_avatar || null,
        show_id: String(show_id),
        season: parseInt(season, 10),
        review_text: review_text.trim(),
        rating: rating ? parseFloat(rating) : null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/tv/season-reviews?id=X&userId=Y
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const userId = searchParams.get("userId");

  if (!id || !userId) {
    return NextResponse.json({ error: "Missing id or userId" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("season_reviews")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
