import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseSecret = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseSecret);

// GET /api/reviews/replies?reviewId=X or reviewIds=X,Y
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const reviewId = searchParams.get("reviewId");
    const reviewIdsParam = searchParams.get("reviewIds");

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

    const { data: replies, error } = await supabaseAdmin
      .from("review_replies")
      .select("*")
      .in("review_id", idsToFetch)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching replies:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const replyList = replies || [];

    // Enrich replies with avatar_url from profiles
    const userIds = Array.from(new Set(replyList.map((r: any) => r.user_id)));
    let avatarMap: Record<string, string> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, avatar_url")
        .in("user_id", userIds);

      if (profiles) {
        profiles.forEach((p: any) => {
          if (p.avatar_url) avatarMap[p.user_id] = p.avatar_url;
        });
      }
    }

    const enrichedReplies = replyList.map((r: any) => ({
      ...r,
      avatar_url: avatarMap[r.user_id] || null,
    }));

    // Group by review_id
    const repliesMap: Record<string, any[]> = {};
    idsToFetch.forEach((id) => {
      repliesMap[id] = [];
    });

    enrichedReplies.forEach((r: any) => {
      if (!repliesMap[r.review_id]) repliesMap[r.review_id] = [];
      repliesMap[r.review_id].push(r);
    });

    return NextResponse.json({
      repliesMap,
      replies: enrichedReplies,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch replies" }, { status: 500 });
  }
}

// POST /api/reviews/replies - Create reply
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { review_id, user_id, user_name, reply_text, author_id, movie_title, user_avatar } = body;

    if (!review_id || !user_id || !reply_text || !reply_text.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const newReply = {
      review_id,
      user_id,
      user_name: user_name || "Cine Member",
      reply_text: reply_text.trim(),
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("review_replies")
      .insert(newReply)
      .select()
      .single();

    if (error) {
      console.error("Error creating reply:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch avatar URL for newly inserted reply
    let avatar_url = user_avatar || null;
    if (!avatar_url) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("avatar_url")
        .eq("user_id", user_id)
        .maybeSingle();
      if (prof?.avatar_url) avatar_url = prof.avatar_url;
    }

    // Optional notification to review author
    if (author_id && author_id !== user_id) {
      const titleText = movie_title ? ` on "${movie_title}"` : "";
      const actorText = user_name || "Someone";
      try {
        await supabaseAdmin
          .from("notifications")
          .insert({
            user_id: author_id,
            actor_id: user_id,
            actor_name: actorText,
            actor_avatar: avatar_url || null,
            type: "review_reply",
            message: `${actorText} replied to your review${titleText}`,
            created_at: new Date().toISOString(),
          });
      } catch (_) {}
    }

    return NextResponse.json({
      reply: {
        ...(data || newReply),
        avatar_url,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to post reply" }, { status: 500 });
  }
}

// DELETE /api/reviews/replies?replyId=X&userId=Y
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const replyId = searchParams.get("replyId");
    const userId = searchParams.get("userId");

    if (!replyId || !userId) {
      return NextResponse.json({ error: "Missing replyId or userId" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("review_replies")
      .delete()
      .eq("id", replyId)
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, replyId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete reply" }, { status: 500 });
  }
}
