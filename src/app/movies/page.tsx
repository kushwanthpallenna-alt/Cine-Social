"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAuthPrompt } from "@/components/AuthPromptProvider";
import { supabase } from "@/lib/supabase";
import { getMovieUrl, getTvUrl } from "@/lib/slug";

function WatchlistView() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const { showAuthPrompt } = useAuthPrompt();
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"movies" | "tv">("movies");
  // Map of [type_id] or [id] → preferred poster_path
  const [posterPrefs, setPosterPrefs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    const fetchWatchlist = async () => {
      try {
        const { data, error } = await supabase
          .from("watchlist")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (data) {
          setWatchlist(data);
          // Batch-fetch poster preferences for all watchlist items (movies + tv shows)
          if (data.length > 0) {
            const items = data.map((m: any) => ({
              movie_id: String(m.movie_id),
              content_type: m.content_type || "movie",
            }));
            fetch("/api/poster-preference/batch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ user_id: user.id, items }),
            })
              .then((r) => r.json())
              .then((prefs: { movie_id: string; content_type?: string; poster_path: string }[]) => {
                if (Array.isArray(prefs)) {
                  const map: Record<string, string> = {};
                  prefs.forEach((p) => {
                    const type = p.content_type || "movie";
                    map[`${type}_${p.movie_id}`] = p.poster_path;
                    map[p.movie_id] = p.poster_path;
                  });
                  setPosterPrefs(map);
                }
              })
              .catch(() => { });
          }
        }
      } catch (err) {
        console.error("Error fetching watchlist:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchWatchlist();
  }, [user]);

  const movieWatchlist = useMemo(
    () => watchlist.filter((item) => (item.content_type || "movie") !== "tv"),
    [watchlist]
  );
  const tvWatchlist = useMemo(
    () => watchlist.filter((item) => item.content_type === "tv"),
    [watchlist]
  );
  const currentList = activeTab === "movies" ? movieWatchlist : tvWatchlist;

  return (
    <div className="bg-[#050505] text-[#e5e2e1] font-body-md overflow-x-clip min-h-screen relative pb-32">
      <header className="fixed top-0 left-0 w-full z-50 bg-[#131313]/60 backdrop-blur-[40px] border-b border-white/10 flex justify-between items-center px-container-margin py-stack-md shadow-[0_8px_32px_0_rgba(255,180,170,0.05)]">
        <Link href="/" className="hover:opacity-90 active:scale-98 transition-all block">
          <h1 className="font-display-md text-[24px] text-primary tracking-tighter uppercase select-none font-serif">
            YOUR WATCHLIST
          </h1>
        </Link>
      </header>

      <main className="pt-[100px] px-container-margin max-w-screen-xl mx-auto w-full">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : !user ? (
          <div className="text-center py-20 glass-card rounded-xl border border-white/10 max-w-md mx-auto">
            <span className="material-symbols-outlined text-[48px] text-primary mb-4">account_circle</span>
            <h2 className="font-title-lg text-title-lg mb-2">Sign in Required</h2>
            <p className="text-on-surface-variant mb-6">Please sign in to view your saved titles.</p>
            <button
              onClick={() => {
                showAuthPrompt({
                  title: "View Your Watchlist",
                  message: "Sign in to view, organize, and track your saved movies and TV shows.",
                });
              }}
              className="bg-primary text-black px-6 py-3 rounded-full font-bold inline-block border-none cursor-pointer hover:brightness-110 active:scale-95 transition-all"
            >
              Sign In
            </button>
          </div>
        ) : (
          <div>
            {/* Split Switcher: Movies vs TV Shows */}
            <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
              <div className="flex items-center gap-2 p-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                <button
                  onClick={() => setActiveTab("movies")}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                    activeTab === "movies"
                      ? "bg-primary text-black shadow-lg shadow-primary/20 scale-[1.02]"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">movie</span>
                  Movies
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      activeTab === "movies" ? "bg-black/20 text-black" : "bg-white/10 text-white/70"
                    }`}
                  >
                    {movieWatchlist.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("tv")}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                    activeTab === "tv"
                      ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30 scale-[1.02]"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">tv</span>
                  TV Shows
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      activeTab === "tv" ? "bg-black/30 text-white" : "bg-white/10 text-white/70"
                    }`}
                  >
                    {tvWatchlist.length}
                  </span>
                </button>
              </div>

              <div className="text-xs text-white/40">
                Total Saved: <span className="text-white/80 font-bold">{watchlist.length}</span>
              </div>
            </div>

            {/* Current Tab Grid or Empty State */}
            {currentList.length === 0 ? (
              <div className="text-center py-20 glass-card rounded-xl border border-white/10 max-w-md mx-auto animate-fade-in">
                <span className="material-symbols-outlined text-[48px] text-on-surface-variant/50 mb-4">
                  {activeTab === "tv" ? "tv_off" : "bookmark_border"}
                </span>
                <h2 className="font-title-lg text-title-lg mb-2">
                  {activeTab === "tv" ? "Your TV Show Watchlist is Empty" : "Your Movie Watchlist is Empty"}
                </h2>
                <p className="text-on-surface-variant text-sm max-w-xs mx-auto">
                  {activeTab === "tv"
                    ? "TV shows you bookmark will appear here."
                    : "Movies you bookmark will appear here."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-stack-md animate-fade-in">
                {currentList.map((item: any) => {
                  const isTv = item.content_type === "tv";
                  const itemType = isTv ? "tv" : "movie";
                  const linkHref = isTv ? getTvUrl(item.movie_id, item.movie_title) : getMovieUrl(item.movie_id, item.movie_title);
                  const displayPoster =
                    posterPrefs[`${itemType}_${item.movie_id}`] ??
                    posterPrefs[String(item.movie_id)] ??
                    item.poster_path;

                  return (
                    <Link
                      key={`${itemType}_${item.id || item.movie_id}`}
                      href={linkHref}
                      className="group cursor-pointer block relative"
                    >
                      <div className="aspect-[2/3] rounded-xl overflow-hidden border border-white/10 relative mb-2 bg-white/5">
                        <img
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          alt={item.movie_title || "Poster"}
                          src={
                            displayPoster
                              ? `https://image.tmdb.org/t/p/w500${displayPoster}`
                              : isTv
                              ? "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=500"
                              : "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500"
                          }
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        
                        {/* Type badge */}
                        <div className="absolute top-2 left-2">
                          <span
                            className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded backdrop-blur-md border ${
                              isTv
                                ? "bg-purple-900/80 text-purple-200 border-purple-500/40"
                                : "bg-red-950/80 text-red-200 border-red-500/40"
                            }`}
                          >
                            {isTv ? "TV" : "Movie"}
                          </span>
                        </div>
                      </div>
                      <h4 className="text-body-md font-bold truncate group-hover:text-primary transition-colors">
                        {item.movie_title || "Untitled"}
                      </h4>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-[60px] z-50 mb-container-margin mx-container-margin rounded-full bg-surface/40 backdrop-blur-[100px] border border-white/10 flex justify-around items-center px-6 shadow-[0_0_20px_rgba(255,180,170,0.1)] max-w-md md:left-1/2 md:-translate-x-1/2">
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/"><span className="material-symbols-outlined">home</span></Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/recommendations"><span className="material-symbols-outlined">search</span></Link>
        <Link className="flex items-center justify-center text-primary relative after:content-[''] after:absolute after:-bottom-2 after:w-1 after:h-1 after:bg-primary after:rounded-full after:shadow-[0_0_8px_#ffb4aa] active:scale-90" href="/movies"><span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>bookmark</span></Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/community"><span className="material-symbols-outlined">group</span></Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/profile"><span className="material-symbols-outlined">person</span></Link>
      </nav>
    </div>
  );
}

function MoviePageRouter() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const movieId = searchParams.get("id");

  useEffect(() => {
    if (movieId) {
      router.replace(getMovieUrl(movieId));
    }
  }, [movieId, router]);

  if (movieId) {
    return (
      <div className="bg-[#050505] min-h-screen text-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return <WatchlistView />;
}

export default function MoviesPage() {
  return (
    <Suspense fallback={<div className="bg-[#050505] min-h-screen" />}>
      <MoviePageRouter />
    </Suspense>
  );
}
