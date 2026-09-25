import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SECRET_KEY || ""
);

// DELETE /api/settings/delete-account
// Body: { userId }
export async function DELETE(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "Missing userId." }, { status: 400 });
    }

    // Delete in dependency order — children first, profile last
    const tables: Array<{ table: string; column: string; extraMatch?: Record<string, string> }> = [
      { table: "notifications", column: "user_id" },
      { table: "notifications", column: "actor_id" },
      { table: "reviews", column: "user_id" },
      { table: "ratings", column: "user_id" },
      { table: "watched", column: "user_id" },
      { table: "watchlist", column: "user_id" },
      { table: "favorites", column: "user_id" },
      { table: "user_mood_preferences", column: "user_id" },
    ];

    for (const { table, column } of tables) {
      try {
        await supabaseAdmin.from(table).delete().eq(column, userId);
      } catch {
        // Table may not exist — continue
      }
    }

    // Delete followers rows (both as follower and as followee)
    try {
      await supabaseAdmin.from("followers").delete().eq("follower_id", userId);
      await supabaseAdmin.from("followers").delete().eq("following_id", userId);
    } catch { /* ignore */ }

    // Finally delete the profile itself
    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("user_id", userId);

    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
