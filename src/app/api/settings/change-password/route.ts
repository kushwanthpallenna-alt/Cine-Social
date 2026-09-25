import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SECRET_KEY || ""
);

// POST /api/settings/change-password
// Body: { userId, currentPassword, newPassword }
export async function POST(request: Request) {
  try {
    const { userId, currentPassword, newPassword } = await request.json();

    if (!userId || !currentPassword || !newPassword) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }
    if (!userId.startsWith("cred_")) {
      return NextResponse.json({ error: "Password change is only available for username/password accounts." }, { status: 403 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "New password must be at least 6 characters." }, { status: 400 });
    }

    // Fetch current hash
    const { data: profile, error: fetchErr } = await supabaseAdmin
      .from("profiles")
      .select("password_hash")
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchErr || !profile?.password_hash) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Verify current password
    const valid = await bcrypt.compare(currentPassword, profile.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }

    // Hash new password
    const newHash = await bcrypt.hash(newPassword, 12);

    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update({ password_hash: newHash, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
