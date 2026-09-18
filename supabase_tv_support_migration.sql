-- ============================================================
-- MIGRATION: Add content_type column to watched, watchlist, ratings, reviews
-- This allows TV shows to be stored distinctly from movies.
-- Default is 'movie' so all existing data is preserved.
--
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor)
-- ============================================================

-- 1. Add content_type to watched table & unique constraint
ALTER TABLE public.watched
  ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'movie';

ALTER TABLE public.watched
  DROP CONSTRAINT IF EXISTS unique_user_content_watched;

ALTER TABLE public.watched
  ADD CONSTRAINT unique_user_content_watched UNIQUE(user_id, movie_id, content_type);

-- 2. Add content_type to watchlist table
ALTER TABLE public.watchlist
  ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'movie';

-- 3. Add content_type to ratings table
-- Also update the unique constraint to include content_type so a user can rate
-- both the movie AND the TV show with the same TMDB ID (rare but correct).
ALTER TABLE public.ratings
  ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'movie';

-- Drop the old unique constraint and replace with one that includes content_type
ALTER TABLE public.ratings
  DROP CONSTRAINT IF EXISTS unique_user_movie_rating;

ALTER TABLE public.ratings
  ADD CONSTRAINT unique_user_content_rating UNIQUE(user_id, movie_id, content_type);

-- 4. Add content_type to reviews table
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'movie';

-- 5. Support half-point ratings: change rating column from integer to numeric(3,1)
--    This allows values like 7.5, 8.5, 4.0, etc.
--    Existing integer values (e.g. 8) will automatically become 8.0 — no data loss.
ALTER TABLE public.ratings
  ALTER COLUMN rating TYPE NUMERIC(3,1) USING rating::NUMERIC(3,1);

-- 6. Add 'liked' boolean column to ratings table
--    Default false preserves existing rows as "not explicitly liked".
ALTER TABLE public.ratings
  ADD COLUMN IF NOT EXISTS liked BOOLEAN NOT NULL DEFAULT false;

