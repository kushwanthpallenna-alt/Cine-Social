-- ============================================================
-- MIGRATION: Create missing follows and notifications tables + RLS
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor)
-- ============================================================

-- 1. Create Follows Table
CREATE TABLE IF NOT EXISTS public.follows (
    follower_id TEXT NOT NULL,
    following_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id)
);

-- Enable RLS for follows
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Add RLS policy allowing public access on follows
DROP POLICY IF EXISTS "Allow public access on follows" ON public.follows;
CREATE POLICY "Allow public access on follows" ON public.follows FOR ALL USING (true) WITH CHECK (true);

-- 2. Create Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    actor_id TEXT,
    actor_name TEXT,
    actor_avatar TEXT,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Add RLS policy allowing public access on notifications
DROP POLICY IF EXISTS "Allow public access on notifications" ON public.notifications;
CREATE POLICY "Allow public access on notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);
