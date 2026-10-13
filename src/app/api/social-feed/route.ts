import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SECRET_KEY || ""
);

const PAGE_SIZE = 15;

// GET /api/social-feed?userId=X&page=0&filter=all
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const page = parseInt(searchParams.get("page") || "0", 10);
  const filter = searchParams.get("filter") || "all";

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  // 1. Get list of people this user follows
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

  // 2. Fetch profiles for display names / avatars AND custom poster preferences of followed users
  const [{ data: profiles }, { data: posterPrefsData }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("user_id, display_name, username, avatar_url")
      .in("user_id", followingIds),
    supabaseAdmin
      .from("user_poster_preferences")
      .select("user_id, movie_id, poster_path, content_type")
      .in("user_id", followingIds),
  ]);

  const profileMap = new Map<string, any>(profiles?.map((p) => [p.user_id, p]) || []);
  const posterPrefMap = new Map<string, string>();
  (posterPrefsData || []).forEach((p) => {
    if (p.user_id && p.movie_id && p.poster_path) {
      const type = p.content_type || "movie";
      posterPrefMap.set(`${p.user_id}_${type}_${p.movie_id}`, p.poster_path);
      posterPrefMap.set(`${p.user_id}_${p.movie_id}`, p.poster_path);
    }
  });

  const getCustomPoster = (uid: string, mid: string, cType: string, defaultPath: string = "") => {
    const type = cType || "movie";
    return (
      posterPrefMap.get(`${uid}_${type}_${mid}`) ||
      posterPrefMap.get(`${uid}_${mid}`) ||
      defaultPath
    );
  };

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // 3. Direct queries when a specific filter is selected
  if (filter === "review") {
    const [{ data: revs }, { data: seasonRevs }] = await Promise.all([
      supabaseAdmin
        .from("reviews")
        .select("id, user_id, user_name, movie_id, review_text, content_type, created_at")
        .in("user_id", followingIds)
        .order("created_at", { ascending: false })
        .limit((page + 1) * PAGE_SIZE + 15),
      supabaseAdmin
        .from("season_reviews")
        .select("id, user_id, user_name, show_id, season, review_text, rating, created_at")
        .in("user_id", followingIds)
        .order("created_at", { ascending: false })
        .limit((page + 1) * PAGE_SIZE + 15),
    ]);

    const combined: any[] = [];
    (revs || []).forEach((rev) => {
      const profile = profileMap.get(rev.user_id);
      const ts = rev.created_at || new Date().toISOString();
      combined.push({
        type: "review",
        user_id: rev.user_id,
        display_name: profile?.display_name || profile?.username || rev.user_name || "Unknown",
        avatar_url: profile?.avatar_url || null,
        movie_id: rev.movie_id,
        review_text: rev.review_text,
        poster_path: getCustomPoster(rev.user_id, rev.movie_id, rev.content_type || "movie", ""),
        content_type: rev.content_type || "movie",
        created_at: ts,
        id: `review_${rev.id}`,
      });
    });
    (seasonRevs || []).forEach((sr) => {
      const profile = profileMap.get(sr.user_id);
      const ts = sr.created_at || new Date().toISOString();
      combined.push({
        type: "season_review",
        user_id: sr.user_id,
        display_name: profile?.display_name || profile?.username || sr.user_name || "Unknown",
        avatar_url: profile?.avatar_url || null,
        movie_id: sr.show_id,
        review_text: sr.review_text,
        rating: sr.rating,
        season: sr.season,
        poster_path: getCustomPoster(sr.user_id, sr.show_id, "tv", ""),
        content_type: "tv",
        created_at: ts,
        id: `season_review_${sr.id}`,
      });
    });
    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const pageItems = combined.slice(from, to + 1);
    const hasMore = pageItems.length > PAGE_SIZE;
    return NextResponse.json({ items: pageItems.slice(0, PAGE_SIZE), total: combined.length, hasMore });
  }

  if (filter === "watched") {
    const [{ data: watched }, { data: rewatchList }] = await Promise.all([
      supabaseAdmin
        .from("watched")
        .select("user_id, movie_id, movie_title, poster_path, content_type, watched_at, created_at")
        .in("user_id", followingIds)
        .order("watched_at", { ascending: false })
        .limit((page + 1) * PAGE_SIZE + 15),
      supabaseAdmin
        .from("watch_log")
        .select("id, user_id, content_id, content_type, title, poster_path, watched_at, rating, is_rewatch, created_at")
        .in("user_id", followingIds)
        .eq("is_rewatch", true)
        .order("watched_at", { ascending: false })
        .limit((page + 1) * PAGE_SIZE + 15),
    ]);

    const combined: any[] = [];
    (watched || []).forEach((w) => {
      const profile = profileMap.get(w.user_id);
      const ts = w.watched_at || w.created_at || new Date().toISOString();
      combined.push({
        type: "watched",
        user_id: w.user_id,
        display_name: profile?.display_name || profile?.username || "Unknown",
        avatar_url: profile?.avatar_url || null,
        movie_id: w.movie_id,
        movie_title: w.movie_title || "",
        poster_path: getCustomPoster(w.user_id, w.movie_id, w.content_type || "movie", w.poster_path || ""),
        content_type: w.content_type || "movie",
        created_at: ts,
        id: `watched_${w.user_id}_${w.movie_id}_${new Date(ts).getTime()}`,
      });
    });
    (rewatchList || []).forEach((rw) => {
      const profile = profileMap.get(rw.user_id);
      const ts = rw.watched_at || rw.created_at || new Date().toISOString();
      combined.push({
        type: "rewatch",
        user_id: rw.user_id,
        display_name: profile?.display_name || profile?.username || "Unknown",
        avatar_url: profile?.avatar_url || null,
        movie_id: rw.content_id,
        movie_title: rw.title || "",
        rating: rw.rating,
        poster_path: getCustomPoster(rw.user_id, rw.content_id, rw.content_type || "movie", rw.poster_path || ""),
        content_type: rw.content_type || "movie",
        created_at: ts,
        id: `rewatch_${rw.id}`,
      });
    });
    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const pageItems = combined.slice(from, to + 1);
    const hasMore = pageItems.length > PAGE_SIZE;
    return NextResponse.json({ items: pageItems.slice(0, PAGE_SIZE), total: combined.length, hasMore });
  }

  if (filter === "watchlist") {
    const { data: watchlist, count } = await supabaseAdmin
      .from("watchlist")
      .select("user_id, movie_id, movie_title, poster_path, content_type, created_at", { count: "exact" })
      .in("user_id", followingIds)
      .order("created_at", { ascending: false })
      .range(from, to + 1);

    const hasMore = (watchlist || []).length > PAGE_SIZE;
    const pageItems = (watchlist || []).slice(0, PAGE_SIZE);

    const items = pageItems.map((w) => {
      const profile = profileMap.get(w.user_id);
      const ts = w.created_at || new Date().toISOString();
      return {
        type: "watchlist",
        user_id: w.user_id,
        display_name: profile?.display_name || profile?.username || "Unknown",
        avatar_url: profile?.avatar_url || null,
        movie_id: w.movie_id,
        movie_title: w.movie_title || "",
        poster_path: getCustomPoster(w.user_id, w.movie_id, w.content_type || "movie", w.poster_path || ""),
        content_type: w.content_type || "movie",
        created_at: ts,
        id: `watchlist_${w.user_id}_${w.movie_id}_${new Date(ts).getTime()}`,
      };
    });

    return NextResponse.json({ items, total: count ?? items.length, hasMore });
  }

  if (filter === "rating") {
    const { data: ratings, count } = await supabaseAdmin
      .from("ratings")
      .select("user_id, movie_id, rating, content_type, created_at", { count: "exact" })
      .in("user_id", followingIds)
      .order("created_at", { ascending: false })
      .range(from, to + 1);

    const hasMore = (ratings || []).length > PAGE_SIZE;
    const pageItems = (ratings || []).slice(0, PAGE_SIZE);

    const items = pageItems.map((r) => {
      const profile = profileMap.get(r.user_id);
      const ts = r.created_at || new Date().toISOString();
      return {
        type: "rating",
        user_id: r.user_id,
        display_name: profile?.display_name || profile?.username || "Unknown",
        avatar_url: profile?.avatar_url || null,
        movie_id: r.movie_id,
        rating: r.rating,
        poster_path: getCustomPoster(r.user_id, r.movie_id, r.content_type || "movie", ""),
        content_type: r.content_type || "movie",
        created_at: ts,
        id: `rating_${r.user_id}_${r.movie_id}_${new Date(ts).getTime()}`,
      };
    });

    return NextResponse.json({ items, total: count ?? items.length, hasMore });
  }

  // 4. "all" filter: Fetch recent activity from ratings, watchlist, reviews, and watched in parallel
  const queryLimit = Math.max((page + 1) * PAGE_SIZE + 50, PAGE_SIZE * 5);

  const [ratingsRes, watchlistRes, reviewsRes, watchedRes, rewatchRes, seasonRevRes] = await Promise.all([
    supabaseAdmin
      .from("ratings")
      .select("user_id, movie_id, rating, content_type, created_at")
      .in("user_id", followingIds)
      .order("created_at", { ascending: false })
      .limit(queryLimit),
    supabaseAdmin
      .from("watchlist")
      .select("user_id, movie_id, movie_title, poster_path, content_type, created_at")
      .in("user_id", followingIds)
      .order("created_at", { ascending: false })
      .limit(queryLimit),
    supabaseAdmin
      .from("reviews")
      .select("id, user_id, user_name, movie_id, review_text, content_type, created_at")
      .in("user_id", followingIds)
      .order("created_at", { ascending: false })
      .limit(queryLimit),
    supabaseAdmin
      .from("watched")
      .select("user_id, movie_id, movie_title, poster_path, content_type, watched_at, created_at")
      .in("user_id", followingIds)
      .order("watched_at", { ascending: false })
      .limit(queryLimit),
    supabaseAdmin
      .from("watch_log")
      .select("id, user_id, content_id, content_type, title, poster_path, watched_at, rating, is_rewatch, created_at")
      .in("user_id", followingIds)
      .eq("is_rewatch", true)
      .order("watched_at", { ascending: false })
      .limit(queryLimit),
    supabaseAdmin
      .from("season_reviews")
      .select("id, user_id, user_name, show_id, season, review_text, rating, created_at")
      .in("user_id", followingIds)
      .order("created_at", { ascending: false })
      .limit(queryLimit),
  ]);

  const items: any[] = [];

  (watchedRes.data || []).forEach((w) => {
    const profile = profileMap.get(w.user_id);
    const ts = w.watched_at || w.created_at || new Date().toISOString();
    items.push({
      type: "watched",
      user_id: w.user_id,
      display_name: profile?.display_name || profile?.username || "Unknown",
      avatar_url: profile?.avatar_url || null,
      movie_id: w.movie_id,
      movie_title: w.movie_title || "",
      poster_path: getCustomPoster(w.user_id, w.movie_id, w.content_type || "movie", w.poster_path || ""),
      content_type: w.content_type || "movie",
      created_at: ts,
      id: `watched_${w.user_id}_${w.movie_id}_${new Date(ts).getTime()}`,
    });
  });

  (ratingsRes.data || []).forEach((r) => {
    const profile = profileMap.get(r.user_id);
    const ts = r.created_at || new Date().toISOString();
    items.push({
      type: "rating",
      user_id: r.user_id,
      display_name: profile?.display_name || profile?.username || "Unknown",
      avatar_url: profile?.avatar_url || null,
      movie_id: r.movie_id,
      rating: r.rating,
      poster_path: getCustomPoster(r.user_id, r.movie_id, r.content_type || "movie", ""),
      content_type: r.content_type || "movie",
      created_at: ts,
      id: `rating_${r.user_id}_${r.movie_id}_${new Date(ts).getTime()}`,
    });
  });

  (watchlistRes.data || []).forEach((w) => {
    const profile = profileMap.get(w.user_id);
    const ts = w.created_at || new Date().toISOString();
    items.push({
      type: "watchlist",
      user_id: w.user_id,
      display_name: profile?.display_name || profile?.username || "Unknown",
      avatar_url: profile?.avatar_url || null,
      movie_id: w.movie_id,
      movie_title: w.movie_title || "",
      poster_path: getCustomPoster(w.user_id, w.movie_id, w.content_type || "movie", w.poster_path || ""),
      content_type: w.content_type || "movie",
      created_at: ts,
      id: `watchlist_${w.user_id}_${w.movie_id}_${new Date(ts).getTime()}`,
    });
  });

  (reviewsRes.data || []).forEach((rev) => {
    const profile = profileMap.get(rev.user_id);
    const ts = rev.created_at || new Date().toISOString();
    items.push({
      type: "review",
      user_id: rev.user_id,
      display_name: profile?.display_name || profile?.username || rev.user_name || "Unknown",
      avatar_url: profile?.avatar_url || null,
      movie_id: rev.movie_id,
      review_text: rev.review_text,
      poster_path: getCustomPoster(rev.user_id, rev.movie_id, rev.content_type || "movie", ""),
      content_type: rev.content_type || "movie",
      created_at: ts,
      id: `review_${rev.id}`,
    });
  });

  // Rewatches from watch_log
  (rewatchRes.data || []).forEach((rw) => {
    const profile = profileMap.get(rw.user_id);
    const ts = rw.watched_at || rw.created_at || new Date().toISOString();
    items.push({
      type: "rewatch",
      user_id: rw.user_id,
      display_name: profile?.display_name || profile?.username || "Unknown",
      avatar_url: profile?.avatar_url || null,
      movie_id: rw.content_id,
      movie_title: rw.title || "",
      rating: rw.rating,
      poster_path: getCustomPoster(rw.user_id, rw.content_id, rw.content_type || "movie", rw.poster_path || ""),
      content_type: rw.content_type || "movie",
      created_at: ts,
      id: `rewatch_${rw.id}`,
    });
  });

  // Season reviews
  (seasonRevRes.data || []).forEach((sr) => {
    const profile = profileMap.get(sr.user_id);
    const ts = sr.created_at || new Date().toISOString();
    items.push({
      type: "season_review",
      user_id: sr.user_id,
      display_name: profile?.display_name || profile?.username || sr.user_name || "Unknown",
      avatar_url: profile?.avatar_url || null,
      movie_id: sr.show_id,
      review_text: sr.review_text,
      rating: sr.rating,
      season: sr.season,
      poster_path: getCustomPoster(sr.user_id, sr.show_id, "tv", ""),
      content_type: "tv",
      created_at: ts,
      id: `season_review_${sr.id}`,
    });
  });

  // Sort all items by created_at desc, then paginate
  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const paginated = items.slice(from, to + 1);
  const hasMore = items.length > to + 1;

  return NextResponse.json({ items: paginated, total: items.length, hasMore });
}
