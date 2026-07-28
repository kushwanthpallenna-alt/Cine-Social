-- ============================================================
-- MIGRATION: Fix type mismatches and create missing tables
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Fix profiles.user_id: change from UUID to TEXT so Google OAuth
--    numeric IDs (e.g. "117302123456") are accepted.
ALTER TABLE public.profiles ALTER COLUMN user_id TYPE TEXT;

-- Add a unique constraint on user_id so upsert with onConflict:'user_id' works.
--    (The live table has a separate UUID `id` PK, so without this constraint,
--    upserting on user_id would fail.)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_key;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);

-- Give profiles.id a default value so new rows don't need to supply it explicitly.
--    The live table has id UUID NOT NULL with no default — this caused the error:
--    "null value in column 'id' violates not-null constraint"
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Also drop the NOT NULL constraint on avatar_url so upsert works
--    even before a user has uploaded an avatar.
ALTER TABLE public.profiles ALTER COLUMN avatar_url DROP NOT NULL;

-- 2. Create the `watched` table (distinct from `watchlist`).
--    user_id is TEXT to match Google OAuth numeric sub claims.
CREATE TABLE IF NOT EXISTS public.watched (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    movie_id TEXT NOT NULL,
    movie_title TEXT NOT NULL,
    poster_path TEXT,
    watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS with open policy (admin client bypasses RLS anyway).
ALTER TABLE public.watched ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access on watched" ON public.watched;
CREATE POLICY "Allow public access on watched" ON public.watched FOR ALL USING (true) WITH CHECK (true);

-- 3. Create the `favorites` table.
--    user_id is TEXT to match Google OAuth numeric sub claims.
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    slot_type TEXT NOT NULL,
    tmdb_id TEXT NOT NULL,
    name TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_slot UNIQUE (user_id, slot_type),
    CONSTRAINT check_slot_type CHECK (slot_type IN (
        'movie_1', 'movie_2', 'movie_3', 'movie_4', 'movie_5',
        'director', 'actor', 'actress'
    ))
);

-- Enable RLS with open policy (admin client bypasses RLS anyway).
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users to manage only their own rows" ON public.favorites;
CREATE POLICY "Allow users to manage only their own rows" ON public.favorites
    FOR ALL USING (true) WITH CHECK (true);
