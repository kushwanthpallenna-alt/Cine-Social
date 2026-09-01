"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useSession, signOut } from "next-auth/react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProvider";

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

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

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
    const isSaved = watchlistIds.has(movieIdStr);
    
    // Set loading state for this specific movie
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
        const { error } = await supabase
          .from("watchlist")
          .delete()
          .eq("user_id", user.id)
          .eq("movie_id", movieIdStr);
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
            movie_title: movie.title || movie.name || "Unknown Movie",
            poster_path: movie.poster_path || "",
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

  const handleHorizontalScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    if (container.scrollWidth - container.scrollLeft - container.clientWidth < 300) {
      loadMoreTrending();
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

        {/* Continue Watching (Wide Cards) */}
        <section className="mt-stack-xl px-container-margin max-w-screen-xl mx-auto">
          <div className="flex justify-between items-end mb-stack-md">
            <h3 className="font-headline-lg text-headline-lg font-serif">Continue Watching</h3>
            <Link className="text-primary text-label-sm flex items-center gap-1 hover:underline" href="/movies?id=872585">
              View All <span className="material-symbols-outlined text-sm">chevron_right</span>
            </Link>
          </div>
          <Carousel containerClassName="gap-gutter pb-4 -mx-container-margin px-container-margin md:mx-0 md:px-0 snap-x snap-mandatory scroll-px-container-margin md:scroll-px-0">
            {/* Card 1 - Blade Runner 2049 */}
            <Link href="/movies?id=335984" className="min-w-[280px] md:min-w-[340px] group/card cursor-pointer block snap-start">
              <div className="relative h-[180px] rounded-xl overflow-hidden glass-panel">
                <Image
                  alt="Blade Runner"
                  className="object-cover transition-transform duration-500 group-hover/card:scale-110"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAxf9CS53Dv5MGRtqtidFPZZwuyRjx7Qfu3Q4gR0k3y3v2SdUPXJ8eljOk_L3Ln6CRUd4GYL8BlJoiFLESYXhrTUL7OW4OkZ46rwY1YdyHyI-qw59EeJ_ZQZ-ZlqXys28NnKcg_DWJ_hifTNB90kcelsEIA2zv9Vi-5OoZnEixk3MaY560tCHGGvdhpnu5st_FCI_cwhwscpW4vMpYwgEaTRj3WZCWYF0a9NT01rpj9wTmC0crSI2RepF_-6nhkSOjfAwhGP9H5CIo"
                  fill
                  loading="lazy"
                  sizes="(max-width: 768px) 280px, 340px"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity">
                  <div className="w-12 h-12 rounded-full bg-primary/80 flex items-center justify-center">
                    <span className="material-symbols-outlined text-black" style={{ fontVariationSettings: "'FILL' 1" }}>
                      play_arrow
                    </span>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                  <div className="h-full bg-primary-container w-[65%]"></div>
                </div>
              </div>
              <div className="mt-stack-sm flex justify-between items-start">
                <div>
                  <h4 className="font-title-lg text-title-lg group-hover/card:text-primary transition-colors">
                    Blade Runner 2049
                  </h4>
                  <p className="text-on-surface-variant text-body-md">1h 42m left</p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant">more_vert</span>
              </div>
            </Link>

            {/* Card 2 - The Godfather */}
            <Link href="/movies?id=238" className="min-w-[280px] md:min-w-[340px] group/card cursor-pointer block snap-start">
              <div className="relative h-[180px] rounded-xl overflow-hidden glass-panel">
                <Image
                  alt="Classic Noir"
                  className="object-cover transition-transform duration-500 group-hover/card:scale-110"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDp_uAbl8kXVsezA3J8wftI2-DCzOYNWBkGo2W3104npOwRSX1qr-ShURspHLlDytgyMW2oDFQXHXnFi8puIsFybFSCec-TRugsGf_uh75tMwRm-anXdIMKnCJc_9yA_q4modScsI2Rd9rpHY7ExVCnJ-1Rn3n6nheMuydp1od364yDtknEbFrgcQtP7sGImpVysal2aN6e0xIeHvw5J4clQoY8pWjVLZIPtlw3SDmAqbWUJaEnGLOVYVPIaydtmjyRNlI-xj_KQGU"
                  fill
                  loading="lazy"
                  sizes="(max-width: 768px) 280px, 340px"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity">
                  <div className="w-12 h-12 rounded-full bg-primary/80 flex items-center justify-center">
                    <span className="material-symbols-outlined text-black" style={{ fontVariationSettings: "'FILL' 1" }}>
                      play_arrow
                    </span>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                  <div className="h-full bg-primary-container w-[15%]"></div>
                </div>
              </div>
              <div className="mt-stack-sm flex justify-between items-start">
                <div>
                  <h4 className="font-title-lg text-title-lg group-hover/card:text-primary transition-colors">
                    The Godfather
                  </h4>
                  <p className="text-on-surface-variant text-body-md">2h 15m left</p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant">more_vert</span>
              </div>
            </Link>
          </Carousel>
        </section>

        {/* Friends Activity (Exclusive Section) */}
        <section className="mt-stack-xl px-container-margin max-w-screen-xl mx-auto">
          <div className="glass-panel p-stack-lg rounded-2xl border-primary/10">
            <h3 className="font-title-lg text-title-lg mb-stack-md flex items-center gap-2 font-serif">
              <span className="material-symbols-outlined text-primary">group</span>
              Friends are Watching
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
              <Link href="/movies?id=872585" className="flex items-center gap-stack-md p-stack-sm rounded-lg hover:bg-white/5 transition-colors cursor-pointer block">
                <div className="relative flex-shrink-0">
                  <Image
                    alt="Friend 1"
                    className="w-10 h-10 rounded-full object-cover border border-white/20"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCsbOCgiRCJjBm38ZBkIr4rZ47v-oetCvz_BXwq8Q1FsBwX1hfCFzHu8UY0PZaY702HTr5ktwK3xH-FWvpSYHK13gRhsfM8Bg6sim71ue6DE-Zcc6PcI9TYxqxKCshDmJ7KGjsceAjCXqlDqRI9SsNaz8WGTIzcUiXqTccWUwIOrPRrZEs1jwkr-BS6eir4EzfM_ltUP3G9gIjElccoHck6XljXu2riN0EqwwzkrlMQfoGy7BUWriSYnr6fFDWP-LVHeF2ZWym7ZNs"
                    width={40}
                    height={40}
                    loading="lazy"
                    sizes="40px"
                  />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary rounded-full border-2 border-surface flex items-center justify-center">
                    <span className="material-symbols-outlined text-[8px] text-on-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                      play_arrow
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-body-md font-semibold">
                    Sarah <span className="font-normal text-on-surface-variant">is watching</span>
                  </p>
                  <p className="text-primary text-body-md font-bold">Oppenheimer</p>
                </div>
              </Link>

              <Link href="/movies?id=792307" className="flex items-center gap-stack-md p-stack-sm rounded-lg hover:bg-white/5 transition-colors cursor-pointer block">
                <div className="relative flex-shrink-0">
                  <Image
                    alt="Friend 2"
                    className="w-10 h-10 rounded-full object-cover border border-white/20"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuD8slP0yJdPEhjFz0UG9T6zmCA1BrtLo9H8_GhWFOaxrE7q-8GmOfwIbpHjF-riFTivojnQgW3TTZIA2gByt8jhxFmg3qo32pRL4WR6E4zHchxuazOZsYsxNjVuIDhTTVMXeJ_cpUEwgZnGvK9b9n-iZ8mNOqSH_JYiSDyWwkmqrScNHtKU_aQfRL7R0oUj9vwYpv0cdGJGbiJUxbJpwpwxWuG371KYq9TnFg_YJmrMXlnI1JVsmJvmWClT8nZAveC3hO6_Sxju5yI"
                    width={40}
                    height={40}
                    loading="lazy"
                    sizes="40px"
                  />
                </div>
                <div>
                  <p className="text-body-md font-semibold">
                    Marcus <span className="font-normal text-on-surface-variant">rated 5.0</span>
                  </p>
                  <p className="text-secondary text-body-md font-bold">Poor Things</p>
                </div>
              </Link>

              <Link href="/movies?id=840430" className="hidden md:flex items-center gap-stack-md p-stack-sm rounded-lg hover:bg-white/5 transition-colors cursor-pointer block">
                <div className="relative flex-shrink-0">
                  <Image
                    alt="Friend 3"
                    className="w-10 h-10 rounded-full object-cover border border-white/20"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuA0KBTb49s9MTsf4tg9J8_22Ctm0lFjrHJaB1iMEfc1MsBDUWude1b5wQ6peS6XxwLSl9nfWRfYqU8NfiWWBKmfKK-Yeucd_uv8YqJcWvHatZNxrxZL7LDQBF-mQ4OljuhwNoF4Lvw7HyQIRtLhxFeWGsEVg08XwJ4an3tXxaoIyn6mCapcgpNN_lRRgjhECMlN1NnNek4cdyNYFOM3k059CMCflMjrXiJG9sqMQyrVTWAOZEjUVakX6gS7gCNTwEpQE8C6aNmb53E"
                    width={40}
                    height={40}
                    loading="lazy"
                    sizes="40px"
                  />
                </div>
                <div>
                  <p className="text-body-md font-semibold">
                    Alex <span className="font-normal text-on-surface-variant">just started</span>
                  </p>
                  <p className="text-primary text-body-md font-bold">The Holdovers</p>
                </div>
              </Link>
            </div>
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

        {/* Trending TV Shows Carousel */}
        <section className="mt-stack-xl px-container-margin max-w-screen-xl mx-auto">
          <div className="flex justify-between items-end mb-stack-md">
            <h3 className="font-headline-lg text-headline-lg font-serif">Trending TV Shows</h3>
          </div>

          <Carousel containerClassName="gap-gutter pb-4 -mx-container-margin px-container-margin md:mx-0 md:px-0 snap-x snap-mandatory scroll-px-container-margin md:scroll-px-0">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <PosterSkeleton key={i} />)
            ) : trendingTv.length > 0 ? (
              trendingTv.map((show: any) => {
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
              })
            ) : (
              <p className="text-on-surface-variant py-4">No trending TV shows available.</p>
            )}
          </Carousel>
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
        <button className="w-12 h-12 rounded-full glass-panel flex items-center justify-center text-on-surface hover:text-primary transition-colors shadow-lg active:scale-90 cursor-pointer">
          <span className="material-symbols-outlined">filter_list</span>
        </button>
        <button className="w-14 h-14 rounded-full bg-gradient-to-br from-secondary to-primary-container text-on-primary-container flex items-center justify-center shadow-[0_0_20px_rgba(255,180,170,0.3)] hover:brightness-110 active:scale-90 transition-all cursor-pointer">
          <span className="material-symbols-outlined font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>
            add
          </span>
        </button>
      </div>

      {/* BottomNavBar */}
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
