import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SECRET_KEY || ""
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, displayName } = body;

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
    }

    const cleanUsername = username.toLowerCase().trim();

    if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      return NextResponse.json({ error: "Username must be 3–30 characters." }, { status: 400 });
    }
    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      return NextResponse.json({ error: "Username may only contain letters, numbers, and underscores." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    // Check uniqueness
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("username", cleanUsername)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Username is already taken." }, { status: 409 });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const user_id = `cred_${randomUUID()}`;

    const { error: insertError } = await supabaseAdmin
      .from("profiles")
      .insert({
        user_id,
        username: cleanUsername,
        display_name: displayName?.trim() || cleanUsername,
        password_hash,
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, username: cleanUsername });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
