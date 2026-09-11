"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useSession, signOut } from "next-auth/react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProvider";
import { getSafeAvatarUrl } from "@/lib/avatar";

const NotificationBell = dynamic(() => import("@/components/NotificationBell"), { ssr: false });
const Carousel = dynamic(() => import("@/components/Carousel"));



const GENRE_MAP: { [key: number]: string } = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western"
};

function getGenresString(genreIds: number[], releaseDate: string) {
  const year = releaseDate ? new Date(releaseDate).getFullYear() : "";
  const genres = (genreIds || [])
    .map((id) => GENRE_MAP[id])
    .filter(Boolean)
    .slice(0, 2)
    .join(" / ")
    .toUpperCase();
  return `${year}${year && genres ? " • " : ""}${genres}`;
}

const HeroSkeleton = () => (
  <section className="relative w-full h-[650px] md:h-[750px] overflow-hidden bg-[#121212] flex items-end p-container-margin animate-skeleton-pulse">
    <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#121212]/60 to-transparent"></div>
    <div className="relative z-10 max-w-screen-xl mx-auto w-full pb-10">
      <div className="glass-panel p-6 md:p-8 rounded-2xl max-w-2xl space-y-4 border border-white/10 bg-white/5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-5 bg-white/15 rounded-md w-28 animate-skeleton-pulse"></div>
          <div className="h-4 bg-white/10 rounded-md w-36 animate-skeleton-pulse"></div>
        </div>
        <div className="h-10 md:h-14 bg-white/15 rounded-xl w-4/5 animate-skeleton-pulse"></div>
        <div className="space-y-2">
          <div className="h-4 bg-white/10 rounded w-full animate-skeleton-pulse"></div>
          <div className="h-4 bg-white/10 rounded w-11/12 animate-skeleton-pulse"></div>
          <div className="h-4 bg-white/10 rounded w-3/4 animate-skeleton-pulse"></div>
        </div>
        <div className="flex gap-4 pt-2">
          <div className="h-11 bg-white/15 rounded-full w-36 animate-skeleton-pulse"></div>
          <div className="h-11 bg-white/15 rounded-full w-32 animate-skeleton-pulse"></div>
        </div>
      </div>
    </div>
  </section>
);

const PosterSkeleton = () => (
  <div className="w-[160px] md:w-[200px] flex-shrink-0 space-y-2">
    <div className="aspect-[2/3] rounded-xl bg-white/10 border border-white/5 animate-skeleton-pulse"></div>
    <div className="h-4 bg-white/10 rounded-md w-3/4 animate-skeleton-pulse"></div>
    <div className="h-3 bg-white/5 rounded-md w-1/2 animate-skeleton-pulse"></div>
  </div>
);

const RankSkeleton = () => (
  <div className="relative flex items-center min-w-[200px] md:min-w-[260px] flex-shrink-0">
    <div className="w-16 h-20 bg-white/10 rounded-xl animate-skeleton-pulse"></div>
    <div className="ml-16 md:ml-24 w-[120px] md:w-[160px] aspect-[2/3] rounded-xl bg-white/10 border border-white/5 animate-skeleton-pulse"></div>
  </div>
);

export default function Home() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [heroMovie, setHeroMovie] = useState<any>(null);
  const [trendingMovies, setTrendingMovies] = useState<any[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<any[]>([]);
  const [trendingTv, setTrendingTv] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
 
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  // TV shows pagination & view mode
  const [tvPage, setTvPage] = useState(1);
  const [loadingMoreTv, setLoadingMoreTv] = useState(false);
  const [tvViewMode, setTvViewMode] = useState<"slider" | "grid">("slider");

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Quick Log Modal states
  const [showQuickLogModal, setShowQuickLogModal] = useState(false);
  const [quickLogQuery, setQuickLogQuery] = useState("");
  const [quickLogResults, setQuickLogResults] = useState<any[]>([]);
  const [quickLogSearching, setQuickLogSearching] = useState(false);
  const [quickLogLoadingId, setQuickLogLoadingId] = useState<string | null>(null);

  // Friends activity states
  const [friendsActivity, setFriendsActivity] = useState<any[]>([]);
  const [friendsDetails, setFriendsDetails] = useState<Record<string, any>>({});

  // View mode state for trending movies
  const [viewMode, setViewMode] = useState<"slider" | "grid">("slider");

  // Hero trailer states
  const [heroTrailerKey, setHeroTrailerKey] = useState<string | null>(null);
  const [showTrailerModal, setShowTrailerModal] = useState(false);

  // Watchlist states
  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set());
  const [watchlistLoadingId, setWatchlistLoadingId] = useState<string | null>(null);

  const { showToast } = useToast();

  const loadMoreTrending = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await fetch(`/api/tmdb?endpoint=trending/movie/day&page=${nextPage}`);
      if (res.ok) {
        const data = await res.json();
        if (data.results) {
          setTrendingMovies(prev => [...prev, ...data.results]);
          setPage(nextPage);
        }
      }
    } catch (e) {
      console.error("Failed to load more trending movies", e);
    } finally {
      setLoadingMore(false);
    }
  };

  const loadMoreTv = async () => {
    if (loadingMoreTv) return;
    setLoadingMoreTv(true);
    try {
      const nextPage = tvPage + 1;
      const res = await fetch(`/api/tmdb?endpoint=trending/tv/week&page=${nextPage}`);
      if (res.ok) {
        const data = await res.json();
        if (data.results) {
          setTrendingTv(prev => [...prev, ...data.results]);
          setTvPage(nextPage);
        }
      }
    } catch (e) {
      console.error("Failed to load more trending TV shows", e);
    } finally {
      setLoadingMoreTv(false);
    }
  };

  // Search query debounced effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/tmdb?endpoint=search/multi&query=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          const filtered = (data.results || []).filter((item: any) => item.media_type === "movie" || item.media_type === "tv" || (!item.media_type && (item.title || item.name)));
          setSearchResults(filtered);
        }
      } catch (err) {
        console.error("Error searching movies and TV shows on home page:", err);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Fetch watchlist IDs for the logged-in user
  useEffect(() => {
    if (!user) return;
    async function fetchWatchlist() {
      try {
        const { data, error } = await supabase
          .from("watchlist")
          .select("movie_id")
          .eq("user_id", user.id);
        if (data) {
          setWatchlistIds(new Set(data.map((item: any) => String(item.movie_id))));
        }
      } catch (err) {
        console.error("Error fetching watchlist IDs:", err);
      }
    }
    fetchWatchlist();
  }, [user]);

  // Fetch hero movie trailer
  useEffect(() => {
    if (!heroMovie?.id) return;
    async function fetchHeroTrailer() {
      try {
        const videosRes = await fetch(`/api/tmdb?endpoint=movie/${heroMovie.id}/videos`);
        if (videosRes.ok) {
          const videosData = await videosRes.json();
          if (videosData?.results) {
            const trailer = videosData.results.find((v: any) => v.site === "YouTube" && v.type === "Trailer");
            if (trailer) {
              setHeroTrailerKey(trailer.key);
            } else {
              const anyVideo = videosData.results.find((v: any) => v.site === "YouTube");
              if (anyVideo) setHeroTrailerKey(anyVideo.key);
            }
          }
        }
      } catch (err) {
        console.error("Error loading hero trailer:", err);
      }
    }
    fetchHeroTrailer();
  }, [heroMovie]);

  // Watchlist Toggle with optimistic updates
  const handleWatchlistToggle = async (movie: any) => {
    if (!user) return;
    const movieIdStr = String(movie.id);
    const isTv = movie.media_type === "tv" || (movie.first_air_date && !movie.release_date) || (!movie.title && !!movie.name);
    const contentType = isTv ? "tv" : "movie";
    const isSaved = watchlistIds.has(movieIdStr);
    
    // Set loading state for this specific title
    setWatchlistLoadingId(movieIdStr);
    
    // Optimistic state update
    const nextWatchlistIds = new Set(watchlistIds);
    if (isSaved) {
      nextWatchlistIds.delete(movieIdStr);
    } else {
      nextWatchlistIds.add(movieIdStr);
    }
    setWatchlistIds(nextWatchlistIds);

    try {
      if (isSaved) {
        let delQuery = supabase
          .from("watchlist")
          .delete()
          .eq("user_id", user.id)
          .eq("movie_id", movieIdStr);
        if (contentType === "tv") {
          delQuery = delQuery.eq("content_type", "tv");
        } else {
          delQuery = delQuery.or("content_type.eq.movie,content_type.is.null");
        }
        const { error } = await delQuery;
        if (error) {
          // Revert on error
          setWatchlistIds(watchlistIds);
          console.error("Error deleting from watchlist:", error);
          showToast("Failed to update watchlist");
        } else {
          showToast("Removed from watchlist!");
        }
      } else {
        const { error } = await supabase
          .from("watchlist")
          .insert({
            user_id: user.id,
            movie_id: movieIdStr,
            movie_title: movie.title || movie.name || "Unknown Title",
            poster_path: movie.poster_path || "",
            content_type: contentType,
          });
        if (error) {
          // Revert on error
          setWatchlistIds(watchlistIds);
          console.error("Error inserting into watchlist:", error);
          showToast("Failed to update watchlist");
        } else {
          showToast("Added to watchlist!");
        }
      }
    } catch (err) {
      // Revert on error
      setWatchlistIds(watchlistIds);
      console.error("Error toggling watchlist:", err);
    } finally {
      setWatchlistLoadingId(null);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const [trendingRes, topRatedRes, trendingTvRes] = await Promise.all([
          fetch("/api/tmdb?endpoint=trending/movie/day"),
          fetch("/api/tmdb?endpoint=movie/top_rated"),
          fetch("/api/tmdb?endpoint=trending/tv/week")
        ]);

        const trendingData = await trendingRes.json();
        const topRatedData = await topRatedRes.json();
        const trendingTvData = await trendingTvRes.json();

        if (trendingData.results && trendingData.results.length > 0) {
          setHeroMovie(trendingData.results[0]);
          setTrendingMovies(trendingData.results.slice(1, 11)); // Next 10 movies
        }
        if (topRatedData.results) {
          setTopRatedMovies(topRatedData.results.slice(0, 5)); // Top 5 movies
        }
        if (trendingTvData.results) {
          setTrendingTv(trendingTvData.results.slice(0, 10)); // Top 10 TV shows
        }
      } catch (error) {
        console.error("Error fetching home page data:", error);
        // Fallback data
        const mockMovies = [
          { id: 1, title: "Dune: Part Two", overview: "Paul Atreides unites with Chani and the Fremen while on a warpath of revenge against the conspirators who destroyed his family.", backdrop_path: "/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg", poster_path: "/1pdfLvkbY9ohJlCjQH2JGjjc9CW.jpg", genre_ids: [28, 878] },
          { id: 2, title: "Godzilla x Kong", poster_path: "/tMefBSflR6PGQLvLuPEoBiYXI44.jpg" },
          { id: 3, title: "Civil War", poster_path: "/sh7Rg8Er3tFcN9BpKIPOMvALgZd.jpg" }
        ];
        setHeroMovie(mockMovies[0]);
        setTrendingMovies(mockMovies);
        const mockTopMovies = [
          { id: 238, title: "The Godfather", poster_path: "/3bhkrj58Vtu7enYsRolD1fZdja1.jpg" },
          { id: 278, title: "The Shawshank Redemption", poster_path: "/9cqNxx0GxF0bflZmeSMuL5tnGza.jpg" },
          { id: 240, title: "The Godfather Part II", poster_path: "/hek3koDUyRQk7FIhPXsa6mT2Zc3.jpg" },
        ];
        setTopRatedMovies(mockTopMovies);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const sentinelTvRef = useRef<HTMLDivElement | null>(null);

  // Quick log debounce effect
  useEffect(() => {
    if (!quickLogQuery.trim()) {
      setQuickLogResults([]);
      setQuickLogSearching(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setQuickLogSearching(true);
      try {
        const res = await fetch(`/api/tmdb?endpoint=search/multi&query=${encodeURIComponent(quickLogQuery)}`);
        if (res.ok) {
          const data = await res.json();
          const filtered = (data.results || []).filter(
            (item: any) => item.media_type === "movie" || item.media_type === "tv" || (!item.media_type && (item.title || item.name))
          );
          setQuickLogResults(filtered);
        }
      } catch (err) {
        console.error("Error searching in quick log modal:", err);
      } finally {
        setQuickLogSearching(false);
      }
    }, 350);

    return () => clearTimeout(delayDebounceFn);
  }, [quickLogQuery]);

  // Quick Log handler
  const handleQuickLog = async (item: any) => {
    if (!user?.id) {
      showToast("Please sign in to log a watch");
      return;
    }
    const movieIdStr = String(item.id);
    const isTv = item.media_type === "tv" || (item.name && !item.title);
    const contentType = isTv ? "tv" : "movie";
    const title = item.title || item.name || "Unknown Title";

    setQuickLogLoadingId(movieIdStr);
    try {
      const res = await fetch("/api/watched", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          movie_id: movieIdStr,
          movie_title: title,
          poster_path: item.poster_path || "",
          content_type: contentType,
        }),
      });
      if (res.ok) {
        showToast(`Logged "${title}" as watched!`);
        setShowQuickLogModal(false);
        setQuickLogQuery("");
        setQuickLogResults([]);
      } else {
        showToast("Failed to log watch");
      }
    } catch (err) {
      console.error("Error logging watch:", err);
      showToast("Failed to log watch");
    } finally {
      setQuickLogLoadingId(null);
    }
  };

  // Fetch Friends Activity (Real data from social-feed)
  useEffect(() => {
    if (!user?.id) return;
    async function fetchFriends() {
      try {
        const res = await fetch(`/api/social-feed?userId=${user.id}&page=0`);
        if (res.ok) {
          const data = await res.json();
          const feedItems = (data.items || []).slice(0, 3);
          setFriendsActivity(feedItems);

          const missingIds = feedItems.filter((it: any) => !it.movie_title || !it.poster_path);
          if (missingIds.length > 0) {
            const det: Record<string, any> = {};
            await Promise.all(
              missingIds.map(async (it: any) => {
                const type = it.content_type || "movie";
                try {
                  const tmdbRes = await fetch(`/api/tmdb?endpoint=${type}/${it.movie_id}`);
                  if (tmdbRes.ok) {
                    det[`${type}_${it.movie_id}`] = await tmdbRes.json();
                  }
                } catch {}
              })
            );
            setFriendsDetails(det);
          }
        }
      } catch (e) {
        console.error("Error fetching friends activity on home page:", e);
      }
    }
    fetchFriends();
  }, [user?.id]);

  const handleHorizontalScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    if (container.scrollWidth - container.scrollLeft - container.clientWidth < 300) {
      loadMoreTrending();
    }
  };

  const handleHorizontalScrollTv = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    if (container.scrollWidth - container.scrollLeft - container.clientWidth < 300) {
      loadMoreTv();
    }
  };

  useEffect(() => {
    if (viewMode !== "grid") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        loadMoreTrending();
      }
    }, {
      rootMargin: "200px"
    });

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => {
      if (sentinelRef.current) {
        observer.unobserve(sentinelRef.current);
      }
    };
  }, [viewMode, trendingMovies]);

  useEffect(() => {
    if (tvViewMode !== "grid") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        loadMoreTv();
      }
    }, {
      rootMargin: "200px"
    });

    if (sentinelTvRef.current) {
      observer.observe(sentinelTvRef.current);
    }

    return () => {
      if (sentinelTvRef.current) {
        observer.unobserve(sentinelTvRef.current);
      }
    };
  }, [tvViewMode, trendingTv]);

  return (
    <div className="font-body-md text-on-surface pb-32 bg-[#050505] min-h-screen relative">
      {/* TopAppBar */}
      <header
        className={`fixed top-0 left-0 w-full z-50 flex justify-between items-center px-container-margin transition-all duration-300 ${
          scrolled
            ? "py-stack-sm bg-[#131313]/90 backdrop-blur-md border-b border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]"
            : "py-stack-md bg-gradient-to-b from-[#050505]/90 via-[#050505]/40 to-transparent border-none"
        }`}
      >
        <div className="flex items-center gap-stack-md">
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-8 h-8 rounded-full overflow-hidden border border-primary/20 hover:opacity-80 transition-all focus:outline-none cursor-pointer flex items-center justify-center bg-white/5 relative"
            >
              <Image
                alt={user?.name || "User profile photo"}
                className="object-cover"
                src={user?.image || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}
                fill
                loading="lazy"
                sizes="32px"
              />
            </button>
            
            {showProfileMenu && (
              <div className="absolute left-0 mt-2 w-56 rounded-xl bg-[#131313]/90 border border-white/10 backdrop-blur-md p-2 shadow-[0_10px_30px_rgba(0,0,0,0.5)] z-50 animate-fade-in text-left">
                <div className="px-3 py-2 border-b border-white/10 mb-1">
                  <p className="text-body-md font-semibold text-[#e5e2e1] truncate">{user?.name || "Cine Member"}</p>
                  <p className="text-label-sm text-on-surface-variant truncate opacity-60">{user?.email || ""}</p>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                  className="w-full text-left px-3 py-2 rounded-lg text-primary hover:bg-white/5 transition-colors flex items-center gap-2 font-semibold cursor-pointer border-none bg-transparent"
                >
                  <span className="material-symbols-outlined text-sm">logout</span>
                  Sign Out
                </button>
              </div>
            )}
          </div>
          <Link href="/" className="hover:opacity-90 active:scale-98 transition-all block">
            <h1 className="font-display-md text-display-md text-primary tracking-tighter hidden md:block select-none font-serif">
              CINE SOCIAL
            </h1>
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile tracking-tight md:hidden text-primary select-none font-serif">
              CINE SOCIAL
            </h1>
          </Link>
        </div>

        {/* Home Page Search Input */}
        <div className="flex items-center gap-stack-md flex-1 max-w-xs md:max-w-md mx-4">
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-sm">
              search
            </span>
            <input
              type="text"
              placeholder="Search movies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-full py-1.5 pl-9 pr-8 text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all text-body-md"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-primary transition-colors cursor-pointer border-none bg-transparent text-sm"
              >
                close
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-stack-md">
          <NotificationBell />
        </div>
      </header>

      <main className="relative">
        {searchQuery ? (
          <section className="pt-28 px-container-margin max-w-screen-xl mx-auto min-h-screen pb-32 animate-fade-in">
            <h3 className="font-headline-lg text-headline-lg font-serif mb-stack-md">
              Search Results for "{searchQuery}"
            </h3>
            {searching ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-stack-md">
                {Array.from({ length: 10 }).map((_, i) => <PosterSkeleton key={i} />)}
              </div>
            ) : searchResults.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-stack-md animate-fade-in">
                {searchResults.map((item: any) => {
                  const isTv = item.media_type === "tv" || (item.name && !item.title);
                  const isSaved = watchlistIds.has(String(item.id));
                  const isLoading = watchlistLoadingId === String(item.id);

                  return (
                    <div key={item.id} className="group/card relative block animate-fade-in">
                      <Link href={isTv ? `/tv?id=${item.id}` : `/movies?id=${item.id}`} className="cursor-pointer block">
                        <div className="relative aspect-[2/3] rounded-xl overflow-hidden glass-panel mb-stack-sm bg-white/5">
                          <img
                            alt={item.title || item.name || "Poster"}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-105"
                            src={item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500"}
                          />
                          <span className={`absolute top-2 left-2 z-10 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded backdrop-blur-md shadow-md ${isTv ? "bg-purple-600/90 text-white border border-purple-400/30" : "bg-primary/90 text-black border border-primary/30"}`}>
                            {isTv ? "TV Show" : "Movie"}
                          </span>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity flex flex-col justify-end p-stack-sm">
                            <span className="text-secondary text-sm flex items-center gap-1 font-bold">
                              <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
                                star
                              </span>
                              {item.vote_average ? item.vote_average.toFixed(1) : "N/A"}
                            </span>
                          </div>
                        </div>
                        <h4 className="text-body-md font-semibold group-hover/card:text-primary truncate transition-colors font-body-md">
                          {item.title || item.name}
                        </h4>
                      </Link>
                      
                      {/* Watchlist Toggle Button overlay */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleWatchlistToggle(item);
                        }}
                        disabled={isLoading}
                        className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md flex items-center justify-center text-white border border-white/10 transition-all duration-200 cursor-pointer shadow-lg hover:scale-110 active:scale-95 group-hover/card:opacity-100 md:opacity-0 animate-fade-in"
                      >
                        {isLoading ? (
                          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: isSaved ? "'FILL' 1" : "" }}>
                            {isSaved ? "bookmark" : "bookmark_border"}
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-on-surface-variant">No movies found matching "{searchQuery}"</p>
            )}
          </section>
        ) : (
          <>
            {/* Hero Section */}
            {loading ? (
              <HeroSkeleton />
            ) : heroMovie ? (
              <section className="relative w-full h-screen overflow-hidden">
                <div className="absolute inset-0">
                  {heroMovie.backdrop_path && (
                    <link
                      rel="preload"
                      as="image"
                      href={`https://image.tmdb.org/t/p/original${heroMovie.backdrop_path}`}
                      fetchPriority="high"
                    />
                  )}
                  <Image
                    alt={heroMovie.title || "Trending Movie Backdrop"}
                    className="object-cover"
                    src={heroMovie.backdrop_path ? `https://image.tmdb.org/t/p/original${heroMovie.backdrop_path}` : "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1600"}
                    fill
                    priority
                    sizes="100vw"
                    quality={85}
                  />
                  <div className="absolute inset-0 hero-gradient"></div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-container-margin z-10 max-w-screen-xl mx-auto w-full">
                  <div className="glass-panel p-stack-lg rounded-xl max-w-2xl transform transition-all duration-500 hover:scale-[1.01]">
                    <div className="flex items-center gap-stack-sm mb-stack-sm">
                      <span className="bg-primary/20 text-primary px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase">
                        Trending Now
                      </span>
                      <span className="text-on-surface-variant text-label-sm">
                        {getGenresString(heroMovie.genre_ids, heroMovie.release_date)}
                      </span>
                    </div>
                    <h2 className="font-display-lg text-display-lg text-on-surface mb-stack-md leading-none font-serif">
                      {(heroMovie.title || heroMovie.name || "").toUpperCase()}
                    </h2>
                    <p className="text-body-lg text-on-surface-variant mb-stack-lg line-clamp-3">
                      {heroMovie.overview}
                    </p>
                    <div className="flex flex-wrap gap-stack-md">
                      <Link
                        href={`/movies?id=${heroMovie.id}`}
                        className="bg-primary-container text-on-primary-container px-stack-lg py-3 rounded-full font-semibold flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all"
                      >
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                          info
                        </span>
                        Watch Details
                      </Link>

                      {heroTrailerKey && (
                        <button
                          onClick={() => setShowTrailerModal(true)}
                          className="bg-secondary text-black px-stack-lg py-3 rounded-full font-semibold flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all border-none cursor-pointer"
                        >
                          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                            play_arrow
                          </span>
                          Watch Trailer
                        </button>
                      )}

                      <button
                        onClick={() => handleWatchlistToggle(heroMovie)}
                        disabled={watchlistLoadingId === String(heroMovie.id)}
                        className={`px-stack-lg py-3 rounded-full font-semibold flex items-center gap-2 transition-all backdrop-blur-md cursor-pointer ${
                          watchlistIds.has(String(heroMovie.id))
                            ? "bg-primary text-black shadow-[0_0_20px_rgba(255,180,170,0.3)] border-none"
                            : "border border-secondary text-secondary bg-transparent hover:bg-secondary/10"
                        }`}
                      >
                        {watchlistLoadingId === String(heroMovie.id) ? (
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <>
                            <span className="material-symbols-outlined" style={{ fontVariationSettings: watchlistIds.has(String(heroMovie.id)) ? "'FILL' 1" : "" }}>
                              {watchlistIds.has(String(heroMovie.id)) ? "check" : "add"}
                            </span>
                            Watchlist
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

        {/* Friends Activity / Popular This Week (Real Data) */}
        <section className="mt-stack-xl px-container-margin max-w-screen-xl mx-auto">
          <div className="glass-panel p-stack-lg rounded-2xl border-primary/10">
            {friendsActivity.length > 0 ? (
              <>
                <div className="flex justify-between items-center mb-stack-md">
                  <h3 className="font-title-lg text-title-lg flex items-center gap-2 font-serif">
                    <span className="material-symbols-outlined text-primary">group</span>
                    Friends are Watching
                  </h3>
                  <Link href="/community" className="text-primary text-xs flex items-center gap-0.5 hover:underline">
                    View All <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
                  {friendsActivity.map((item: any) => {
                    const type = item.content_type === "tv" ? "tv" : "movie";
                    const detail = friendsDetails[`${type}_${item.movie_id}`];
                    const title = item.movie_title || detail?.title || detail?.name || "Untitled";
                    const linkHref = type === "tv" ? `/tv?id=${item.movie_id}` : `/movies?id=${item.movie_id}`;
                    const avatarUrl = getSafeAvatarUrl(item.avatar_url);
                    const initials = (item.display_name || "U").slice(0, 2).toUpperCase();

                    let actionText = "watched";
                    let actionIcon = "visibility";
                    if (item.type === "rating") {
                      actionText = `rated ${typeof item.rating === "number" ? (item.rating % 1 === 0 ? item.rating : item.rating.toFixed(1)) : item.rating}`;
                      actionIcon = "grade";
                    } else if (item.type === "review") {
                      actionText = "reviewed";
                      actionIcon = "rate_review";
                    } else if (item.type === "watchlist") {
                      actionText = "wants to watch";
                      actionIcon = "bookmark";
                    }

                    return (
                      <Link
                        key={item.id}
                        href={linkHref}
                        className="flex items-center gap-stack-md p-stack-sm rounded-lg hover:bg-white/5 transition-colors cursor-pointer block group"
                      >
                        <div className="relative flex-shrink-0">
                          {avatarUrl ? (
                            <img
                              alt={item.display_name}
                              className="w-10 h-10 rounded-full object-cover border border-white/20"
                              src={avatarUrl}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                              <span className="text-primary font-bold text-xs font-serif">{initials}</span>
                            </div>
                          )}
                          <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#121212] flex items-center justify-center ${item.type === "rating" ? "bg-secondary" : "bg-primary"}`}>
                            <span className="material-symbols-outlined text-[8px] text-black" style={{ fontVariationSettings: "'FILL' 1" }}>
                              {actionIcon}
                            </span>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-body-md font-semibold truncate">
                            {item.display_name} <span className="font-normal text-on-surface-variant">{actionText}</span>
                          </p>
                          <p className="text-primary text-body-md font-bold truncate group-hover:underline">{title}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </>
            ) : (
              /* Fallback: Trending Now / Popular This Week */
              <>
                <div className="flex justify-between items-center mb-stack-md">
                  <h3 className="font-title-lg text-title-lg flex items-center gap-2 font-serif">
                    <span className="material-symbols-outlined text-primary">local_fire_department</span>
                    Popular This Week
                  </h3>
                  <Link href="/recommendations" className="text-primary text-xs flex items-center gap-0.5 hover:underline">
                    Explore More <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
                  {trendingMovies.slice(0, 3).map((item: any) => {
                    const isTv = item.media_type === "tv" || (item.name && !item.title);
                    const title = item.title || item.name || "Untitled";
                    const linkHref = isTv ? `/tv?id=${item.id}` : `/movies?id=${item.id}`;
                    const poster = item.poster_path ? `https://image.tmdb.org/t/p/w185${item.poster_path}` : null;

                    return (
                      <Link
                        key={`pop_${item.id}`}
                        href={linkHref}
                        className="flex items-center gap-stack-md p-stack-sm rounded-lg hover:bg-white/5 transition-colors cursor-pointer block group"
                      >
                        <div className="relative flex-shrink-0 w-10 h-10 rounded-full overflow-hidden border border-white/20 bg-white/5">
                          {poster ? (
                            <img alt={title} className="w-full h-full object-cover" src={poster} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="material-symbols-outlined text-xs text-white/30">{isTv ? "tv" : "movie"}</span>
                            </div>
                          )}
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-secondary rounded-full border-2 border-[#121212] flex items-center justify-center">
                            <span className="material-symbols-outlined text-[8px] text-black" style={{ fontVariationSettings: "'FILL' 1" }}>
                              star
                            </span>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-body-md font-semibold truncate">
                            Trending <span className="font-normal text-on-surface-variant">{isTv ? "TV Show" : "Film"}</span>
                          </p>
                          <p className="text-primary text-body-md font-bold truncate group-hover:underline">{title}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Trending Now */}
        <section className="mt-stack-xl px-container-margin max-w-screen-xl mx-auto">
          <div className="flex justify-between items-end mb-stack-md">
            <h3 className="font-headline-lg text-headline-lg font-serif">Trending Now</h3>
            <button
              onClick={() => setViewMode(prev => prev === "slider" ? "grid" : "slider")}
              className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors cursor-pointer border-none bg-transparent"
            >
              {viewMode === "slider" ? "grid_view" : "view_headline"}
            </button>
          </div>

          {viewMode === "slider" ? (
            <Carousel
              onScroll={handleHorizontalScroll}
              containerClassName="gap-gutter pb-4 -mx-container-margin px-container-margin md:mx-0 md:px-0 snap-x snap-mandatory scroll-px-container-margin md:scroll-px-0"
            >
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <PosterSkeleton key={i} />)
              ) : trendingMovies.length > 0 ? (
                (() => {
                  const movieCards = trendingMovies.map((movie: any) => {
                    const isSaved = watchlistIds.has(String(movie.id));
                    const isLoading = watchlistLoadingId === String(movie.id);

                    return (
                      <div key={movie.id} className="w-[160px] md:w-[200px] flex-shrink-0 group/card relative snap-start">
                        <Link href={`/movies?id=${movie.id}`} className="cursor-pointer block">
                          <div className="relative aspect-[2/3] rounded-xl overflow-hidden glass-panel mb-stack-sm bg-white/5">
                            <Image
                              alt={movie.title || "Movie Poster"}
                              className="object-cover transition-transform duration-700 group-hover/card:scale-105"
                              src={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500"}
                              fill
                              loading="lazy"
                              sizes="(max-width: 768px) 160px, 200px"
                              draggable={false}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity flex flex-col justify-end p-stack-sm">
                              <span className="text-secondary text-sm flex items-center gap-1 font-bold">
                                <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
                                  star
                                </span>
                                {movie.vote_average ? movie.vote_average.toFixed(1) : "N/A"}
                              </span>
                            </div>
                          </div>
                          <h4 className="text-body-md font-semibold group-hover/card:text-primary truncate transition-colors font-body-md">
                            {movie.title || movie.name}
                          </h4>
                        </Link>
                        
                        {/* Bookmark Button Overlay */}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleWatchlistToggle(movie);
                          }}
                          disabled={isLoading}
                          className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md flex items-center justify-center text-white border border-white/10 transition-all duration-200 cursor-pointer shadow-lg hover:scale-110 active:scale-95 group-hover/card:opacity-100 md:opacity-0"
                        >
                          {isLoading ? (
                            <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: isSaved ? "'FILL' 1" : "" }}>
                              {isSaved ? "bookmark" : "bookmark_border"}
                            </span>
                          )}
                        </button>
                      </div>
                    );
                  });

                  const loadMoreBtn = !loadingMore ? (
                    <button
                      key="load-more-btn"
                      onClick={loadMoreTrending}
                      className="flex-shrink-0 w-[160px] md:w-[200px] aspect-[2/3] rounded-xl border border-dashed border-white/20 flex flex-col items-center justify-center gap-2 hover:border-primary hover:text-primary transition-all active:scale-95 cursor-pointer bg-white/5 text-on-surface"
                    >
                      <span className="material-symbols-outlined text-[32px]">add_circle</span>
                      <span className="font-bold">Load More</span>
                    </button>
                  ) : (
                    <div key="load-more-loading" className="flex-shrink-0 w-[160px] md:w-[200px] aspect-[2/3] rounded-xl border border-dashed border-white/20 flex items-center justify-center bg-white/5">
                      <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  );

                  return [...movieCards, loadMoreBtn];
                })()
              ) : (
                <p className="text-on-surface-variant">No trending movies found</p>
              )}
            </Carousel>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-stack-md animate-fade-in">
                {trendingMovies.map((movie: any) => {
                  const isSaved = watchlistIds.has(String(movie.id));
                  const isLoading = watchlistLoadingId === String(movie.id);

                  return (
                    <div key={movie.id} className="group/card relative block animate-fade-in">
                      <Link href={`/movies?id=${movie.id}`} className="cursor-pointer block">
                        <div className="relative aspect-[2/3] rounded-xl overflow-hidden glass-panel mb-stack-sm bg-white/5">
                          <img
                            alt={movie.title || "Movie Poster"}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-105"
                            src={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500"}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity flex flex-col justify-end p-stack-sm">
                            <span className="text-secondary text-sm flex items-center gap-1 font-bold">
                              <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
                                star
                              </span>
                              {movie.vote_average ? movie.vote_average.toFixed(1) : "N/A"}
                            </span>
                          </div>
                        </div>
                        <h4 className="text-body-md font-semibold group-hover/card:text-primary truncate transition-colors font-body-md font-semibold">
                          {movie.title || movie.name}
                        </h4>
                      </Link>

                      {/* Bookmark Button Overlay */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleWatchlistToggle(movie);
                        }}
                        disabled={isLoading}
                        className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md flex items-center justify-center text-white border border-white/10 transition-all duration-200 cursor-pointer shadow-lg hover:scale-110 active:scale-95 group-hover/card:opacity-100 md:opacity-0"
                      >
                        {isLoading ? (
                          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: isSaved ? "'FILL' 1" : "" }}>
                            {isSaved ? "bookmark" : "bookmark_border"}
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Sentinel for Infinite Scroll */}
              <div ref={sentinelRef} className="flex justify-center py-6 w-full">
                {loadingMore && (
                  <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Trending TV Shows */}
        <section className="mt-stack-xl px-container-margin max-w-screen-xl mx-auto">
          <div className="flex justify-between items-end mb-stack-md">
            <h3 className="font-headline-lg text-headline-lg font-serif">Trending TV Shows</h3>
            <button
              onClick={() => setTvViewMode(prev => prev === "slider" ? "grid" : "slider")}
              className="material-symbols-outlined text-on-surface-variant hover:text-purple-400 transition-colors cursor-pointer border-none bg-transparent"
            >
              {tvViewMode === "slider" ? "grid_view" : "view_headline"}
            </button>
          </div>

          {tvViewMode === "slider" ? (
            <Carousel
              onScroll={handleHorizontalScrollTv}
              containerClassName="gap-gutter pb-4 -mx-container-margin px-container-margin md:mx-0 md:px-0 snap-x snap-mandatory scroll-px-container-margin md:scroll-px-0"
            >
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <PosterSkeleton key={i} />)
              ) : trendingTv.length > 0 ? (
                (() => {
                  const tvCards = trendingTv.map((show: any) => {
                    const isSaved = watchlistIds.has(String(show.id));
                    const isLoading = watchlistLoadingId === String(show.id);

                    return (
                      <div key={show.id} className="w-[160px] md:w-[200px] flex-shrink-0 group/card relative snap-start">
                        <Link href={`/tv?id=${show.id}`} className="cursor-pointer block">
                          <div className="relative aspect-[2/3] rounded-xl overflow-hidden glass-panel mb-stack-sm bg-white/5">
                            <Image
                              alt={show.name || "TV Show Poster"}
                              className="object-cover transition-transform duration-700 group-hover/card:scale-105"
                              src={show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500"}
                              fill
                              loading="lazy"
                              sizes="(max-width: 768px) 160px, 200px"
                              draggable={false}
                            />
                            <span className="absolute top-2 left-2 z-10 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-600/90 text-white backdrop-blur-md border border-purple-400/30 shadow-md">
                              TV Show
                            </span>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity flex flex-col justify-end p-stack-sm">
                              <span className="text-secondary text-sm flex items-center gap-1 font-bold">
                                <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
                                  star
                                </span>
                                {show.vote_average ? show.vote_average.toFixed(1) : "N/A"}
                              </span>
                            </div>
                          </div>
                          <h4 className="text-body-md font-semibold group-hover/card:text-primary truncate transition-colors font-body-md">
                            {show.name || show.title}
                          </h4>
                        </Link>

                        {/* Watchlist Toggle Button Overlay */}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleWatchlistToggle(show);
                          }}
                          disabled={isLoading}
                          className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md flex items-center justify-center text-white border border-white/10 transition-all duration-200 cursor-pointer shadow-lg hover:scale-110 active:scale-95 group-hover/card:opacity-100 md:opacity-0 animate-fade-in"
                        >
                          {isLoading ? (
                            <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: isSaved ? "'FILL' 1" : "" }}>
                              {isSaved ? "bookmark" : "bookmark_border"}
                            </span>
                          )}
                        </button>
                      </div>
                    );
                  });

                  const loadMoreTvBtn = !loadingMoreTv ? (
                    <button
                      key="load-more-tv-btn"
                      onClick={loadMoreTv}
                      className="flex-shrink-0 w-[160px] md:w-[200px] aspect-[2/3] rounded-xl border border-dashed border-purple-500/30 flex flex-col items-center justify-center gap-2 hover:border-purple-400 hover:text-purple-300 transition-all active:scale-95 cursor-pointer bg-white/5 text-on-surface"
                    >
                      <span className="material-symbols-outlined text-[32px] text-purple-400">add_circle</span>
                      <span className="font-bold text-purple-200">Load More</span>
                    </button>
                  ) : (
                    <div key="load-more-tv-loading" className="flex-shrink-0 w-[160px] md:w-[200px] aspect-[2/3] rounded-xl border border-dashed border-purple-500/30 flex items-center justify-center bg-white/5">
                      <div className="h-6 w-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  );

                  return [...tvCards, loadMoreTvBtn];
                })()
              ) : (
                <p className="text-on-surface-variant py-4">No trending TV shows available.</p>
              )}
            </Carousel>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-stack-md animate-fade-in">
                {trendingTv.map((show: any) => {
                  const isSaved = watchlistIds.has(String(show.id));
                  const isLoading = watchlistLoadingId === String(show.id);

                  return (
                    <div key={show.id} className="group/card relative block animate-fade-in">
                      <Link href={`/tv?id=${show.id}`} className="cursor-pointer block">
                        <div className="relative aspect-[2/3] rounded-xl overflow-hidden glass-panel mb-stack-sm bg-white/5">
                          <img
                            alt={show.name || "TV Show Poster"}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-105"
                            src={show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500"}
                          />
                          <span className="absolute top-2 left-2 z-10 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-600/90 text-white backdrop-blur-md border border-purple-400/30 shadow-md">
                            TV Show
                          </span>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity flex flex-col justify-end p-stack-sm">
                            <span className="text-secondary text-sm flex items-center gap-1 font-bold">
                              <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
                                star
                              </span>
                              {show.vote_average ? show.vote_average.toFixed(1) : "N/A"}
                            </span>
                          </div>
                        </div>
                        <h4 className="text-body-md font-semibold group-hover/card:text-primary truncate transition-colors font-body-md">
                          {show.name || show.title}
                        </h4>
                      </Link>

                      {/* Watchlist Toggle Button Overlay */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleWatchlistToggle(show);
                        }}
                        disabled={isLoading}
                        className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md flex items-center justify-center text-white border border-white/10 transition-all duration-200 cursor-pointer shadow-lg hover:scale-110 active:scale-95 group-hover/card:opacity-100 md:opacity-0 animate-fade-in"
                      >
                        {isLoading ? (
                          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: isSaved ? "'FILL' 1" : "" }}>
                            {isSaved ? "bookmark" : "bookmark_border"}
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Sentinel for TV Infinite Scroll in Grid view */}
              <div ref={sentinelTvRef} className="flex justify-center py-6 w-full">
                {loadingMoreTv && (
                  <div className="h-8 w-8 border-4 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Top Rated (Numbered Posters) */}
        <section className="mt-stack-xl px-container-margin max-w-screen-xl mx-auto mb-12">
          <div className="flex justify-between items-end mb-stack-md">
            <h3 className="font-headline-lg text-headline-lg font-serif">Top Rated All Time</h3>
          </div>
          <Carousel containerClassName="gap-12 pb-4 -mx-container-margin px-container-margin md:mx-0 md:px-0 items-center snap-x snap-mandatory scroll-px-container-margin md:scroll-px-0">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <RankSkeleton key={i} />)
            ) : topRatedMovies.length > 0 ? (
              topRatedMovies.map((movie: any, idx: number) => {
                const isSaved = watchlistIds.has(String(movie.id));
                const isLoading = watchlistLoadingId === String(movie.id);

                return (
                  <div key={movie.id} className="relative flex items-center min-w-[200px] md:min-w-[260px] group/card flex-shrink-0 snap-start">
                    <span className="absolute -left-4 md:-left-8 text-[120px] md:text-[180px] font-display-lg leading-none text-transparent bg-clip-text bg-gradient-to-b from-white/20 to-transparent group-hover/card:from-primary/40 transition-all duration-500 z-0 select-none font-serif">
                      {idx + 1}
                    </span>
                    <div className="relative ml-16 md:ml-24 w-[120px] md:w-[160px] aspect-[2/3] rounded-xl overflow-hidden glass-panel shadow-2xl z-10">
                      <Link href={`/movies?id=${movie.id}`} className="cursor-pointer block w-full h-full relative">
                        <Image
                          alt={movie.title || "Top Rated"}
                          className="object-cover transition-transform duration-700 group-hover/card:scale-105"
                          src={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500"}
                          fill
                          loading="lazy"
                          sizes="(max-width: 768px) 120px, 160px"
                          draggable={false}
                        />
                      </Link>
                    </div>

                    {/* Bookmark Button Overlay */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleWatchlistToggle(movie);
                      }}
                      disabled={isLoading}
                      className="absolute top-2 right-2 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md flex items-center justify-center text-white border border-white/10 transition-all duration-200 cursor-pointer shadow-lg hover:scale-110 active:scale-95 group-hover/card:opacity-100 md:opacity-0"
                    >
                      {isLoading ? (
                        <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: isSaved ? "'FILL' 1" : "" }}>
                          {isSaved ? "bookmark" : "bookmark_border"}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })
            ) : (
              <p className="text-on-surface-variant">No top rated movies found</p>
            )}
          </Carousel>
        </section>
          </>
        )}
      </main>

      {/* Floating Quick Actions */}
      <div className="fixed bottom-24 right-container-margin z-50 flex flex-col gap-stack-md">
        <button
          onClick={() => {
            if (!user) {
              showToast("Please sign in to log a watch");
              return;
            }
            setShowQuickLogModal(true);
          }}
          title="Quick Log a Watch"
          className="w-14 h-14 rounded-full bg-gradient-to-br from-secondary to-primary-container text-on-primary-container flex items-center justify-center shadow-[0_0_20px_rgba(255,180,170,0.3)] hover:brightness-110 active:scale-90 transition-all cursor-pointer border-none"
        >
          <span className="material-symbols-outlined font-bold text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            add
          </span>
        </button>
      </div>

      {/* Quick Log Modal */}
      {showQuickLogModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
          onClick={() => setShowQuickLogModal(false)}
        >
          <div
            className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">visibility</span>
                <h3 className="font-serif text-lg text-on-surface font-bold">Quick Log a Watch</h3>
              </div>
              <button
                onClick={() => setShowQuickLogModal(false)}
                className="text-on-surface-variant hover:text-white transition-colors cursor-pointer border-none bg-transparent"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Search Input */}
            <div className="p-4 border-b border-white/10 bg-white/[0.02]">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-sm">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search movie or TV show to log..."
                  autoFocus
                  value={quickLogQuery}
                  onChange={(e) => setQuickLogQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-10 text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 text-body-md"
                />
                {quickLogQuery && (
                  <button
                    onClick={() => setQuickLogQuery("")}
                    className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-white transition-colors cursor-pointer border-none bg-transparent text-sm"
                  >
                    close
                  </button>
                )}
              </div>
            </div>

            {/* Modal Results List */}
            <div className="overflow-y-auto flex-1 p-4 space-y-2 max-h-[50vh]">
              {quickLogSearching ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <div className="h-7 w-7 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs text-on-surface-variant">Searching titles...</p>
                </div>
              ) : quickLogQuery.trim() === "" ? (
                <div className="text-center py-10 text-on-surface-variant/50">
                  <span className="material-symbols-outlined text-[40px] opacity-30 mb-2">movie_filter</span>
                  <p className="text-sm">Type a title above to quickly mark it as watched</p>
                </div>
              ) : quickLogResults.length === 0 ? (
                <div className="text-center py-10 text-on-surface-variant/60">
                  <p className="text-sm">No results found for "{quickLogQuery}"</p>
                </div>
              ) : (
                quickLogResults.map((item: any) => {
                  const isTv = item.media_type === "tv" || (item.name && !item.title);
                  const title = item.title || item.name || "Untitled";
                  const date = item.release_date || item.first_air_date || "";
                  const year = date ? new Date(date).getFullYear() : "";
                  const poster = item.poster_path ? `https://image.tmdb.org/t/p/w185${item.poster_path}` : null;
                  const isLogging = quickLogLoadingId === String(item.id);

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-11 h-16 rounded-lg overflow-hidden bg-white/10 flex-shrink-0 relative">
                          {poster ? (
                            <img src={poster} alt={title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="material-symbols-outlined text-xs text-white/30">{isTv ? "tv" : "movie"}</span>
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm text-on-surface truncate group-hover:text-primary transition-colors">{title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isTv ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "bg-primary/20 text-primary border border-primary/30"}`}>
                              {isTv ? "TV" : "Film"}
                            </span>
                            {year && <span className="text-xs text-on-surface-variant/60">{year}</span>}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleQuickLog(item)}
                        disabled={isLogging}
                        className="px-3.5 py-1.5 rounded-full bg-secondary text-black font-semibold text-xs flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all cursor-pointer border-none shadow-md flex-shrink-0 disabled:opacity-50"
                      >
                        {isLogging ? (
                          <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                              check
                            </span>
                            Mark Watched
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Trailer Modal */}
      {showTrailerModal && heroTrailerKey && (
        <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowTrailerModal(false)}>
          <div className="relative w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <iframe
              src={`https://www.youtube.com/embed/${heroTrailerKey}?autoplay=1`}
              title="Hero Trailer"
              className="w-full h-full border-none"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <button
              onClick={() => setShowTrailerModal(false)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md flex items-center justify-center text-white border border-white/10 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        </div>
      )}
      <nav className="fixed bottom-0 left-0 right-0 h-[60px] z-50 mb-container-margin mx-container-margin rounded-full bg-surface/40 backdrop-blur-[100px] border border-white/10 shadow-[0_0_20px_rgba(255,180,170,0.1)] flex justify-around items-center w-full max-w-md md:left-1/2 md:-translate-x-1/2">
        <Link
          className="flex items-center justify-center text-primary relative after:content-[''] after:absolute after:-bottom-2 after:w-1 after:h-1 after:bg-primary after:rounded-full after:shadow-[0_0_8px_#ffb4aa] active:scale-90 transition-all"
          href="/"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            home
          </span>
        </Link>
        <Link
          className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90"
          href="/recommendations"
        >
          <span className="material-symbols-outlined">search</span>
        </Link>
        <Link
          className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90"
          href="/movies"
        >
          <span className="material-symbols-outlined">bookmark</span>
        </Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/community"><span className="material-symbols-outlined">group</span></Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/profile"><span className="material-symbols-outlined">person</span></Link>
      </nav>
    </div>
  );
}
