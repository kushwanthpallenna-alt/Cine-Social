import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SECRET_KEY || ""
);

// GET /api/follows/list?userId=X&type=followers|following
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUserId = searchParams.get("userId");
  const type = (searchParams.get("type") || "following") as "followers" | "following";

  if (!rawUserId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    // 1. Resolve real userId if a username was passed
    let resolvedUserId = rawUserId;
    const isIdLike =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawUserId) ||
      /^cred_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawUserId) ||
      /^\d+$/.test(rawUserId);

    if (!isIdLike) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("username", rawUserId.toLowerCase().trim())
        .maybeSingle();
      if (prof?.user_id) {
        resolvedUserId = prof.user_id;
      }
    }

    // 2. Query follows table
    // If type === 'followers': query rows where following_id = resolvedUserId (users who follow resolvedUserId)
    // If type === 'following': query rows where follower_id = resolvedUserId (users whom resolvedUserId follows)
    let query = supabaseAdmin.from("follows").select("id, follower_id, following_id, created_at");
    if (type === "followers") {
      query = query.eq("following_id", resolvedUserId);
    } else {
      query = query.eq("follower_id", resolvedUserId);
    }

    const { data: followRows, error: followErr } = await query;

    console.log(`[Follows List] Raw follows rows for userId=${resolvedUserId}, type=${type}:`, followRows);

    if (followErr) {
      console.error("[Follows List] Database error querying follows:", followErr);
      return NextResponse.json({ error: followErr.message }, { status: 500 });
    }

    const rows = followRows || [];
    const targetIds = rows.map((r) => (type === "followers" ? r.follower_id : r.following_id));

    if (targetIds.length === 0) {
      return NextResponse.json({ users: [], count: 0 });
    }

    // 3. Batch fetch profiles for all target IDs
    const { data: profiles, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("user_id, username, display_name, avatar_url, bio")
      .in("user_id", targetIds);

    console.log(`[Follows List] Profile lookup for targetIds=${JSON.stringify(targetIds)} returned:`, profiles);

    if (profileErr) {
      console.error("[Follows List] Database error querying profiles:", profileErr);
    }

    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

    // 4. Map each follow row to a profile, providing a safe fallback entry if missing
    const users = targetIds.map((uid) => {
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
      // Fallback for user without a profiles row so entry is never dropped
      console.warn(`[Follows List] Missing profile row for user_id=${uid}, returning fallback entry.`);
      return {
        user_id: uid,
        username: null,
        display_name: "Cine Member",
        avatar_url: null,
        bio: null,
        is_fallback: true,
      };
    });

    // Count is strictly derived from list length so they can never disagree
    return NextResponse.json({
      users,
      count: users.length,
    });
  } catch (err: any) {
    console.error("[Follows List] Unexpected error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
