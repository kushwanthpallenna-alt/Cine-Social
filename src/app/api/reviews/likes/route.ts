import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseSecret = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseSecret);

// GET /api/reviews/likes?reviewId=X&userId=Y or reviewIds=X,Z&userId=Y
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const reviewId = searchParams.get("reviewId");
    const reviewIdsParam = searchParams.get("reviewIds");
    const userId = searchParams.get("userId");

    const idsToFetch: string[] = [];
    if (reviewId) idsToFetch.push(reviewId);
    if (reviewIdsParam) {
      reviewIdsParam.split(",").forEach((id) => {
        const trimmed = id.trim();
        if (trimmed && !idsToFetch.includes(trimmed)) idsToFetch.push(trimmed);
      });
    }

    if (idsToFetch.length === 0) {
      return NextResponse.json({ error: "Missing reviewId or reviewIds" }, { status: 400 });
    }

    // Fetch all likes for these reviewIds
    const { data: likes, error } = await supabaseAdmin
      .from("review_likes")
      .select("review_id, user_id")
      .in("review_id", idsToFetch);

    if (error) {
      console.error("Error fetching likes:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const likesCountMap: Record<string, number> = {};
    const userLikedSet: string[] = [];

    idsToFetch.forEach((id) => {
      likesCountMap[id] = 0;
    });

    (likes || []).forEach((row: { review_id: string; user_id: string }) => {
      likesCountMap[row.review_id] = (likesCountMap[row.review_id] || 0) + 1;
      if (userId && row.user_id === userId) {
        userLikedSet.push(row.review_id);
      }
    });

    return NextResponse.json({
      likesCountMap,
      userLikedSet,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch likes" }, { status: 500 });
  }
}

// POST /api/reviews/likes - Toggle like
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { review_id, user_id, author_id, movie_title, actor_name, actor_avatar } = body;

    if (!review_id || !user_id) {
      return NextResponse.json({ error: "Missing review_id or user_id" }, { status: 400 });
    }

    // Check if already liked
    const { data: existing, error: checkErr } = await supabaseAdmin
      .from("review_likes")
      .select("id")
      .eq("review_id", review_id)
      .eq("user_id", user_id)
      .maybeSingle();

    if (checkErr) {
      console.error("Error checking existing like:", checkErr);
      return NextResponse.json({ error: checkErr.message }, { status: 500 });
    }

    let isLiked = false;
    if (existing) {
      // Delete (unlike)
      const { error: delErr } = await supabaseAdmin
        .from("review_likes")
        .delete()
        .eq("id", existing.id);

      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }
      isLiked = false;
    } else {
      // Insert (like)
      const { error: insErr } = await supabaseAdmin
        .from("review_likes")
        .insert({ review_id, user_id });

      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
      isLiked = true;

      // Optional notification to review author
      if (author_id && author_id !== user_id) {
        const titleText = movie_title ? ` on "${movie_title}"` : "";
        const actorText = actor_name || "Someone";
        try {
          await supabaseAdmin
            .from("notifications")
            .insert({
              user_id: author_id,
              actor_id: user_id,
              actor_name: actorText,
              actor_avatar: actor_avatar || null,
              type: "review_like",
              message: `${actorText} liked your review${titleText}`,
              created_at: new Date().toISOString(),
            });
        } catch (_) {}
      }
    }

    // Get updated count for this review
    const { count, error: countErr } = await supabaseAdmin
      .from("review_likes")
      .select("*", { count: "exact", head: true })
      .eq("review_id", review_id);

    return NextResponse.json({
      liked: isLiked,
      count: count || 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to toggle like" }, { status: 500 });
  }
}
