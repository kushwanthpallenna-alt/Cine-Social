import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SECRET_KEY || ""
);

// GET /api/follows?userId=X          → { following: [...], followers: [...], followingUsers: [...], followerUsers: [...], followingCount, followerCount }
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

  // 1. Resolve real userId if username was provided
  let resolvedUserId = userId;
  const isIdLike =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId) ||
    /^cred_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId) ||
    /^\d+$/.test(userId);

  if (!isIdLike) {
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("username", userId.toLowerCase().trim())
      .maybeSingle();
    if (prof?.user_id) {
      resolvedUserId = prof.user_id;
    }
  }

  // 2. Fetch raw follows rows before any join
  const [followingRes, followersRes] = await Promise.all([
    supabaseAdmin.from("follows").select("following_id, created_at").eq("follower_id", resolvedUserId),
    supabaseAdmin.from("follows").select("follower_id, created_at").eq("following_id", resolvedUserId),
  ]);

  const rawFollowing = followingRes.data || [];
  const rawFollowers = followersRes.data || [];

  console.log(`[Follows API] Raw following rows for user=${resolvedUserId}:`, rawFollowing);
  console.log(`[Follows API] Raw followers rows for user=${resolvedUserId}:`, rawFollowers);

  const followingIds = rawFollowing.map((r) => r.following_id);
  const followerIds = rawFollowers.map((r) => r.follower_id);
  const allTargetIds = Array.from(new Set([...followingIds, ...followerIds]));

  // 3. Batch fetch profiles
  let profileMap = new Map<string, any>();
  if (allTargetIds.length > 0) {
    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("user_id, username, display_name, avatar_url, bio")
      .in("user_id", allTargetIds);

    console.log(`[Follows API] Profile lookup returned:`, profiles);
    if (pErr) console.error("[Follows API] Error fetching profiles:", pErr);
    if (profiles) {
      profiles.forEach((p) => profileMap.set(p.user_id, p));
    }
  }

  // 4. Build user objects with fallback entry if profile row is missing
  const mapToUser = (uid: string) => {
    const p = profileMap.get(uid);
    if (p) {
      return {
        user_id: p.user_id,
        username: p.username || null,
        display_name: p.display_name || p.username || "Cine Member",
        avatar_url: p.avatar_url || null,
        bio: p.bio || null,
      };
    }
    console.warn(`[Follows API] Missing profile row for user_id=${uid}, returning fallback entry.`);
    return {
      user_id: uid,
      username: null,
      display_name: "Cine Member",
      avatar_url: null,
      bio: null,
      is_fallback: true,
    };
  };

  const followingUsers = followingIds.map(mapToUser);
  const followerUsers = followerIds.map(mapToUser);

  // Derive counts strictly from the list so they can NEVER disagree
  return NextResponse.json({
    following: followingIds,
    followers: followerIds,
    followingUsers,
    followerUsers,
    followingCount: followingUsers.length,
    followerCount: followerUsers.length,
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

    // Fire follow notification
    if (!error) {
      let actorName = follower_name;
      let actorAvatar = follower_avatar || null;

      // Fetch profile details if name/avatar missing or generic
      if (!actorName || actorName === "Someone" || !actorAvatar) {
        try {
          const { data: prof } = await supabaseAdmin
            .from("profiles")
            .select("display_name, username, avatar_url")
            .eq("user_id", follower_id)
            .maybeSingle();
          if (prof) {
            if (!actorName || actorName === "Someone") {
              actorName = prof.display_name || prof.username || "Someone";
            }
            if (!actorAvatar) {
              actorAvatar = prof.avatar_url || null;
            }
          }
        } catch {}
      }
      if (!actorName) actorName = "Someone";

      try {
        const { data: existing } = await supabaseAdmin
          .from("notifications")
          .select("id")
          .eq("user_id", following_id)
          .eq("actor_id", follower_id)
          .eq("type", "follow")
          .maybeSingle();

        if (!existing) {
          const { error: notifErr } = await supabaseAdmin.from("notifications").insert({
            user_id: following_id,
            actor_id: follower_id,
            actor_name: actorName,
            actor_avatar: actorAvatar,
            type: "follow",
            message: `${actorName} started following you`,
            link: `/profile/${follower_id}`,
          });
          if (notifErr) {
            console.error("Error inserting follow notification:", notifErr);
          }
        }
      } catch (e) {
        console.error("Error creating follow notification:", e);
      }
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
