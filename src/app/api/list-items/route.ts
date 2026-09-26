import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseSecret = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseSecret);

// POST /api/list-items  { list_id, movie_id, movie_title, poster_path, content_type, notes }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { list_id, movie_id, movie_title, poster_path = "", content_type = "movie", notes = "" } = body;

    if (!list_id || !movie_id) {
      return NextResponse.json({ error: "Missing list_id or movie_id" }, { status: 400 });
    }

    // Get current max position in this list
    const { data: existing } = await supabaseAdmin
      .from("list_items")
      .select("id, position")
      .eq("list_id", list_id)
      .eq("movie_id", movie_id)
      .eq("content_type", content_type)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Item already in list", existing }, { status: 409 });
    }

    const { data: maxPos } = await supabaseAdmin
      .from("list_items")
      .select("position")
      .eq("list_id", list_id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const position = maxPos ? (maxPos.position || 0) + 1 : 1;

    const { data, error } = await supabaseAdmin
      .from("list_items")
      .insert({ list_id, movie_id, movie_title, poster_path, content_type, notes, position })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update list updated_at
    await supabaseAdmin.from("lists").update({ updated_at: new Date().toISOString() }).eq("id", list_id);

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/list-items  { item_id, position, notes } — reorder or update notes
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { item_id, position, notes } = body;

    if (!item_id) {
      return NextResponse.json({ error: "Missing item_id" }, { status: 400 });
    }

    const updates: any = {};
    if (position !== undefined) updates.position = position;
    if (notes !== undefined) updates.notes = notes;

    const { data, error } = await supabaseAdmin
      .from("list_items")
      .update(updates)
      .eq("id", item_id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/list-items?itemId=
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");

  if (!itemId) {
    return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("list_items").delete().eq("id", itemId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
