/**
 * Migration: Create `lists` and `list_items` tables in Supabase.
 * Usage: node scripts/create_lists_tables.js
 */

const fs = require("fs");
const path = require("path");

// Manual .env.local loader
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) return;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  });
}

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const MIGRATION_SQL = `
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

NOTIFY pgrst, 'reload schema';
`;

async function run() {
  console.log("Testing if 'lists' table exists...\n");

  const { error: testErr } = await supabase.from("lists").select("id").limit(1);

  if (testErr && testErr.message.includes("schema cache")) {
    console.log("The 'lists' table does NOT exist in Supabase.\n");
    console.log("Please run the following SQL in your Supabase Dashboard -> SQL Editor -> New Query:\n");
    console.log("=".repeat(70));
    console.log(MIGRATION_SQL);
    console.log("=".repeat(70));
  } else if (testErr) {
    console.log("Error testing 'lists' table:", testErr.message);
    console.log("\nIf this is a permissions error, run the SQL above manually.");
  } else {
    console.log("'lists' table already exists.");

    const { error: testErr2 } = await supabase.from("list_items").select("id").limit(1);
    if (testErr2) {
      console.log("'list_items' table has an issue:", testErr2.message);
    } else {
      console.log("'list_items' table already exists.");
    }

    console.log("\nIf you're still seeing schema cache errors, run this in Supabase SQL Editor:");
    console.log("  NOTIFY pgrst, 'reload schema';");
  }
}

run().catch(console.error);
