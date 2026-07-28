import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseSecret = process.env.SUPABASE_SECRET_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseSecret);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("avatar_url, bio, username")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || { avatar_url: null, bio: null, username: null });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string;

    if (!file || !userId) {
      return NextResponse.json({ error: "Missing file or userId" }, { status: 400 });
    }

    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}-${Math.random()}.${fileExt}`;
    
    // Convert File to ArrayBuffer then Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload using admin client to bypass storage RLS
    const { error: uploadError } = await supabaseAdmin.storage
      .from("avatars")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data } = supabaseAdmin.storage.from("avatars").getPublicUrl(fileName);
    const publicUrl = data.publicUrl;

    // Save to profiles using admin client.
    // `user_id` is the primary key — no `id` column exists on this table.
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        user_id: userId,
        avatar_url: publicUrl,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ avatar_url: publicUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
