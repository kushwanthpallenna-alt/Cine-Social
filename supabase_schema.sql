-- Create Watchlist Table
CREATE TABLE public.watchlist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    movie_id TEXT NOT NULL,
    movie_title TEXT NOT NULL,
    poster_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for watchlist
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access on watchlist" ON public.watchlist FOR ALL USING (true) WITH CHECK (true);

-- Create Ratings Table
CREATE TABLE public.ratings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    movie_id TEXT NOT NULL,
    rating INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_movie_rating UNIQUE(user_id, movie_id)
);

-- Enable RLS for ratings
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access on ratings" ON public.ratings FOR ALL USING (true) WITH CHECK (true);

-- Create Reviews Table
CREATE TABLE public.reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT,
    movie_id TEXT NOT NULL,
    review_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access on reviews" ON public.reviews FOR ALL USING (true) WITH CHECK (true);

-- Create Watched Table
CREATE TABLE public.watched (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    movie_id TEXT NOT NULL,
    movie_title TEXT NOT NULL,
    poster_path TEXT,
    watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for watched
ALTER TABLE public.watched ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access on watched" ON public.watched FOR ALL USING (true) WITH CHECK (true);

-- Create Profiles Table
CREATE TABLE public.profiles (
    user_id TEXT PRIMARY KEY,
    avatar_url TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access on profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- Create Favorites Table
CREATE TABLE public.favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    slot_type TEXT NOT NULL,
    tmdb_id TEXT NOT NULL,
    name TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_slot UNIQUE (user_id, slot_type),
    CONSTRAINT check_slot_type CHECK (slot_type IN ('movie_1', 'movie_2', 'movie_3', 'movie_4', 'movie_5', 'director', 'actor', 'actress'))
);

-- Enable RLS for favorites
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Add RLS policy allowing users to manage only their own rows based on user_id matching the session user
CREATE POLICY "Allow users to manage only their own rows" ON public.favorites
    FOR ALL
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);



-- Create Follows Table
CREATE TABLE public.follows (
    follower_id TEXT NOT NULL,
    following_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id)
);

-- Enable RLS for follows
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Add RLS policy allowing public access on follows
CREATE POLICY "Allow public access on follows" ON public.follows FOR ALL USING (true) WITH CHECK (true);

-- Create Review Likes Table
CREATE TABLE public.review_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    review_id UUID NOT NULL,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_review_like UNIQUE(review_id, user_id)
);

-- Enable RLS for review_likes
ALTER TABLE public.review_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on review_likes" ON public.review_likes FOR SELECT USING (true);
CREATE POLICY "Allow users to manage their own likes" ON public.review_likes FOR ALL USING (auth.uid()::text = user_id OR true) WITH CHECK (auth.uid()::text = user_id OR true);

-- Create Review Replies Table
CREATE TABLE public.review_replies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    review_id UUID NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT,
    reply_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for review_replies
ALTER TABLE public.review_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on review_replies" ON public.review_replies FOR SELECT USING (true);
CREATE POLICY "Allow users to manage their own replies" ON public.review_replies FOR ALL USING (auth.uid()::text = user_id OR true) WITH CHECK (auth.uid()::text = user_id OR true);

