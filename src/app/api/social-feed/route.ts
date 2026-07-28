import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SECRET_KEY || ""
);

const PAGE_SIZE = 15;

// GET /api/social-feed?userId=X&page=0
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const page = parseInt(searchParams.get("page") || "0", 10);

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  // Get list of people this user follows
  const { data: followRows, error: followError } = await supabaseAdmin
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);

  if (followError) {
    return NextResponse.json({ error: followError.message }, { status: 500 });
  }

  const followingIds = followRows?.map((r) => r.following_id) || [];

  if (followingIds.length === 0) {
    return NextResponse.json({ items: [], total: 0, hasMore: false });
  }

  // Fetch profiles for display names / avatars
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("user_id, display_name, username, avatar_url")
    .in("user_id", followingIds);

  const profileMap = new Map<string, any>(profiles?.map((p) => [p.user_id, p]) || []);

  // Fetch recent activity from ratings, watchlist, reviews in parallel
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [ratingsRes, watchlistRes, reviewsRes] = await Promise.all([
    supabaseAdmin
      .from("ratings")
      .select("user_id, movie_id, rating, created_at")
      .in("user_id", followingIds)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE * 3),
    supabaseAdmin
      .from("watchlist")
      .select("user_id, movie_id, movie_title, poster_path, created_at")
      .in("user_id", followingIds)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE * 3),
    supabaseAdmin
      .from("reviews")
      .select("id, user_id, user_name, movie_id, review_text, created_at")
      .in("user_id", followingIds)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE * 3),
  ]);

  const items: any[] = [];

  (ratingsRes.data || []).forEach((r) => {
    const profile = profileMap.get(r.user_id);
    items.push({
      type: "rating",
      user_id: r.user_id,
      display_name: profile?.display_name || profile?.username || "Unknown",
      avatar_url: profile?.avatar_url || null,
      movie_id: r.movie_id,
      rating: r.rating,
      created_at: r.created_at,
      id: `rating_${r.user_id}_${r.movie_id}`,
    });
  });

  (watchlistRes.data || []).forEach((w) => {
    const profile = profileMap.get(w.user_id);
    items.push({
      type: "watchlist",
      user_id: w.user_id,
      display_name: profile?.display_name || profile?.username || "Unknown",
      avatar_url: profile?.avatar_url || null,
      movie_id: w.movie_id,
      movie_title: w.movie_title,
      poster_path: w.poster_path,
      created_at: w.created_at,
      id: `watchlist_${w.user_id}_${w.movie_id}`,
    });
  });

  (reviewsRes.data || []).forEach((rev) => {
    const profile = profileMap.get(rev.user_id);
    items.push({
      type: "review",
      user_id: rev.user_id,
      display_name: profile?.display_name || profile?.username || rev.user_name || "Unknown",
      avatar_url: profile?.avatar_url || null,
      movie_id: rev.movie_id,
      review_text: rev.review_text,
      created_at: rev.created_at,
      id: `review_${rev.id}`,
    });
  });

  // Sort all items by created_at desc, then paginate
  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const paginated = items.slice(from, to + 1);
  const hasMore = items.length > to + 1;

  return NextResponse.json({ items: paginated, total: items.length, hasMore });
}
