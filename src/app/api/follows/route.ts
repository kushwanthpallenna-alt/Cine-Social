import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SECRET_KEY || ""
);

// GET /api/follows?userId=X          → { following: [...], followers: [...], followingCount, followerCount }
// GET /api/follows?followerId=X&followingId=Y → { isFollowing: bool }
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const followerId = searchParams.get("followerId");
  const followingId = searchParams.get("followingId");

  // Check-if-following query
  if (followerId && followingId) {
    const { data } = await supabaseAdmin
      .from("follows")
      .select("follower_id")
      .eq("follower_id", followerId)
      .eq("following_id", followingId)
      .maybeSingle();
    return NextResponse.json({ isFollowing: !!data });
  }

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const [followingRes, followersRes] = await Promise.all([
    supabaseAdmin.from("follows").select("following_id").eq("follower_id", userId),
    supabaseAdmin.from("follows").select("follower_id").eq("following_id", userId),
  ]);

  return NextResponse.json({
    following: followingRes.data?.map((r) => r.following_id) || [],
    followers: followersRes.data?.map((r) => r.follower_id) || [],
    followingCount: followingRes.data?.length || 0,
    followerCount: followersRes.data?.length || 0,
  });
}

// POST /api/follows  { follower_id, following_id, follower_name?, follower_avatar? }
export async function POST(request: Request) {
  try {
    const { follower_id, following_id, follower_name, follower_avatar } = await request.json();
    if (!follower_id || !following_id) {
      return NextResponse.json({ error: "Missing follower_id or following_id" }, { status: 400 });
    }
    if (follower_id === following_id) {
      return NextResponse.json({ error: "Cannot follow yourself." }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("follows")
      .insert({ follower_id, following_id });

    // Ignore duplicate key error (already following)
    if (error && !error.message.includes("duplicate")) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fire follow notification (fire-and-forget, don't block response)
    if (!error) {
      const actorName = follower_name || "Someone";
      // Try to get avatar from profiles table if not provided
      let actorAvatar = follower_avatar || null;
      if (!actorAvatar) {
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("avatar_url")
          .eq("user_id", follower_id)
          .maybeSingle();
        actorAvatar = prof?.avatar_url || null;
      }

      try {
        await supabaseAdmin.from("notifications").insert({
          user_id: following_id,
          actor_id: follower_id,
          actor_name: actorName,
          actor_avatar: actorAvatar,
          type: "follow",
          message: `${actorName} started following you`,
          link: `/profile/${follower_id}`,
        });
      } catch (_) {}
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


// DELETE /api/follows?followerId=X&followingId=Y
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const followerId = searchParams.get("followerId");
  const followingId = searchParams.get("followingId");

  if (!followerId || !followingId) {
    return NextResponse.json({ error: "Missing followerId or followingId" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("following_id", followingId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
