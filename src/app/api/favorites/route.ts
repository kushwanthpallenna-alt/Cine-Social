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
    .from("favorites")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, slot_type, tmdb_id, name, image_url } = body;

    if (!user_id || !slot_type || !tmdb_id || !name) {
      return NextResponse.json(
        { error: "Missing required fields: user_id, slot_type, tmdb_id, name" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("favorites")
      .upsert({
        user_id,
        slot_type,
        tmdb_id,
        name,
        image_url,
        created_at: new Date().toISOString()
      }, {
        onConflict: "user_id,slot_type"
      })
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data && data.length > 0 ? data[0] : null);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const slotType = searchParams.get("slotType");

  if (!userId || !slotType) {
    return NextResponse.json(
      { error: "Missing userId or slotType" },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("favorites")
    .delete()
    .eq("user_id", userId)
    .eq("slot_type", slotType);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
