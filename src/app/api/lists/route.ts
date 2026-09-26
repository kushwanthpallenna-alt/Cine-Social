import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/*
  SQL Migration — run once in Supabase SQL editor:

  CREATE TABLE IF NOT EXISTS public.lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_ranked BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS public.list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
    movie_id TEXT NOT NULL,
    movie_title TEXT NOT NULL,
    poster_path TEXT DEFAULT '',
    content_type TEXT NOT NULL DEFAULT 'movie',
    position INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    added_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_lists_user_id ON public.lists(user_id);
  CREATE INDEX IF NOT EXISTS idx_list_items_list_id ON public.list_items(list_id);
*/

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseSecret = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseSecret);

// GET /api/lists?userId=&listId=
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const listId = searchParams.get("listId");

  if (listId) {
    // Fetch single list with items
    const { data: list, error: listErr } = await supabaseAdmin
      .from("lists")
      .select("*")
      .eq("id", listId)
      .maybeSingle();

    if (listErr || !list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    const { data: items } = await supabaseAdmin
      .from("list_items")
      .select("*")
      .eq("list_id", listId)
      .order("position", { ascending: true });

    return NextResponse.json({ ...list, items: items || [] });
  }

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  // Fetch all lists for user (with item count)
  const { data, error } = await supabaseAdmin
    .from("lists")
    .select("*, list_items(count)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST /api/lists  { user_id, title, description, is_ranked, is_public }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, title, description = "", is_ranked = false, is_public = true } = body;

    if (!user_id || !title) {
      return NextResponse.json({ error: "Missing user_id or title" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("lists")
      .insert({ user_id, title, description, is_ranked, is_public })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/lists  { list_id, title, description, is_ranked, is_public }
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { list_id, title, description, is_ranked, is_public } = body;

    if (!list_id) {
      return NextResponse.json({ error: "Missing list_id" }, { status: 400 });
    }

    const updates: any = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (is_ranked !== undefined) updates.is_ranked = is_ranked;
    if (is_public !== undefined) updates.is_public = is_public;

    const { data, error } = await supabaseAdmin
      .from("lists")
      .update(updates)
      .eq("id", list_id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/lists?listId=
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const listId = searchParams.get("listId");

  if (!listId) {
    return NextResponse.json({ error: "Missing listId" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("lists").delete().eq("id", listId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
