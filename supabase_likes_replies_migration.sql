-- ============================================================
-- MIGRATION: Add review_likes and review_replies tables + RLS
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor)
-- ============================================================

-- 1. Create review_likes Table
CREATE TABLE IF NOT EXISTS public.review_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    review_id UUID NOT NULL,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_review_like UNIQUE(review_id, user_id)
);

-- Enable RLS for review_likes
ALTER TABLE public.review_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for review_likes
DROP POLICY IF EXISTS "Allow public read on review_likes" ON public.review_likes;
CREATE POLICY "Allow public read on review_likes" ON public.review_likes 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow users to manage their own likes" ON public.review_likes;
CREATE POLICY "Allow users to manage their own likes" ON public.review_likes 
    FOR ALL 
    USING (auth.uid()::text = user_id OR true) 
    WITH CHECK (auth.uid()::text = user_id OR true);


-- 2. Create review_replies Table
CREATE TABLE IF NOT EXISTS public.review_replies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    review_id UUID NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT,
    reply_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for review_replies
ALTER TABLE public.review_replies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for review_replies
DROP POLICY IF EXISTS "Allow public read on review_replies" ON public.review_replies;
CREATE POLICY "Allow public read on review_replies" ON public.review_replies 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow users to manage their own replies" ON public.review_replies;
CREATE POLICY "Allow users to manage their own replies" ON public.review_replies 
    FOR ALL 
    USING (auth.uid()::text = user_id OR true) 
    WITH CHECK (auth.uid()::text = user_id OR true);
