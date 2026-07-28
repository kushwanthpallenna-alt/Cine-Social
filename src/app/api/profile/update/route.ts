import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SECRET_KEY || ""
);

// PATCH /api/profile/update
// Body: { userId, bio?, username? }
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { userId, bio, username } = body;

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const updates: Record<string, any> = {
      user_id: userId,
      updated_at: new Date().toISOString(),
    };

    // Handle bio update
    if (bio !== undefined) {
      if (typeof bio !== "string") {
        return NextResponse.json({ error: "bio must be a string" }, { status: 400 });
      }
      if (bio.length > 150) {
        return NextResponse.json({ error: "Bio must be 150 characters or fewer" }, { status: 400 });
      }
      updates.bio = bio.trim();
    }

    // Handle username update
    if (username !== undefined) {
      if (typeof username !== "string") {
        return NextResponse.json({ error: "username must be a string" }, { status: 400 });
      }
      const trimmed = username.trim().toLowerCase();
      if (trimmed.length === 0) {
        updates.username = null;
      } else {
        if (trimmed.length > 30) {
          return NextResponse.json({ error: "Username must be 30 characters or fewer" }, { status: 400 });
        }
        if (!/^[a-z0-9_]+$/.test(trimmed)) {
          return NextResponse.json(
            { error: "Username can only contain letters, numbers, and underscores" },
            { status: 400 }
          );
        }
        updates.username = trimmed;
      }
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .upsert(updates, { onConflict: "user_id" })
      .select("user_id, username, bio, avatar_url")
      .single();

    if (error) {
      if (error.code === "23505" && error.message.includes("username")) {
        return NextResponse.json(
          { error: "That username is already taken. Please choose another." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
