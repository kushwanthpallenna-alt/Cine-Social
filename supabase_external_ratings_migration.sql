-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: external_ratings cache table
-- Run this in your Supabase SQL editor, then execute the NOTIFY line at the end.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.external_ratings (
    tmdb_id     TEXT        NOT NULL,
    media_type  TEXT        NOT NULL CHECK (media_type IN ('movie', 'tv')),
    imdb_id     TEXT,
    imdb_rating NUMERIC(3,1),   -- e.g. 8.1
    imdb_votes  TEXT,           -- raw string, e.g. "1,200,000"
    rt_score    INTEGER,        -- e.g. 94  (percent)
    metascore   INTEGER,        -- e.g. 82
    fetched_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (tmdb_id, media_type)
);

-- Public read only. Only the server (service_role key) can write, as service_role bypasses RLS.
ALTER TABLE public.external_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "external_ratings_public_read"
    ON public.external_ratings
    FOR SELECT
    USING (true);

-- Tell PostgREST to reload its schema cache so the new table is visible.
NOTIFY pgrst, 'reload schema';
