import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SECRET_KEY || ""
);

// GET /api/notifications?userId=X  → { notifications: [...], unreadCount: N }
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const unreadCount = (data || []).filter((n) => !n.read).length;

  return NextResponse.json({ notifications: data || [], unreadCount });
}

// PATCH /api/notifications  { userId, notificationId? }
// If notificationId is provided: mark that one as read
// If not: mark all for userId as read
export async function PATCH(request: Request) {
  try {
    const { userId, notificationId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    let query = supabaseAdmin
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId);

    if (notificationId) {
      query = query.eq("id", notificationId);
    }

    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/notifications  { user_id, actor_id, actor_name, actor_avatar, type, message, link }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, actor_id, actor_name, actor_avatar, type, message, link } = body;

    if (!user_id || !type || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Don't notify yourself
    if (actor_id && actor_id === user_id) {
      return NextResponse.json({ success: true, skipped: true });
    }

    // Deduplicate: don't send the same follow notification twice
    if (type === "follow") {
      const { data: existing } = await supabaseAdmin
        .from("notifications")
        .select("id")
        .eq("user_id", user_id)
        .eq("actor_id", actor_id)
        .eq("type", "follow")
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ success: true, skipped: true });
      }
    }

    const { error } = await supabaseAdmin.from("notifications").insert({
      user_id,
      actor_id,
      actor_name,
      actor_avatar,
      type,
      message,
      link,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
