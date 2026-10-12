"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAuthPrompt } from "@/components/AuthPromptProvider";
import { supabase } from "@/lib/supabase";
import { getMovieUrl, getTvUrl } from "@/lib/slug";
import WatchlistSearchToAdd from "@/components/WatchlistSearchToAdd";

type SortOption =
  | "default"
  | "runtime_desc"
  | "runtime_asc"
  | "tmdb_desc"
  | "tmdb_asc"
  | "year_desc"
  | "year_asc"
  | "title_asc"
  | "date_added_asc";

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: "default", label: "Default (Date Added)" },
  { id: "runtime_desc", label: "Runtime (Longest)" },
  { id: "runtime_asc", label: "Runtime (Shortest)" },
  { id: "tmdb_desc", label: "TMDB Rating (Highest)" },
  { id: "tmdb_asc", label: "TMDB Rating (Lowest)" },
  { id: "year_desc", label: "Release Year (Newest)" },
  { id: "year_asc", label: "Release Year (Oldest)" },
  { id: "title_asc", label: "Title (A-Z)" },
  { id: "date_added_asc", label: "Date Added (Oldest)" },
];

const GENRE_LIST = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Thriller",
  "War",
  "Western",
];

const GENRE_MAP: Record<number, string> = {
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
  37: "Western",
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};

function WatchlistView() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const { showAuthPrompt } = useAuthPrompt();
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [mediaDetails, setMediaDetails] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"movies" | "tv">("movies");
  // Map of [type_id] or [id] → preferred poster_path
  const [posterPrefs, setPosterPrefs] = useState<Record<string, string>>({});

  // Sorting & Filtering
  const [sortOption, setSortOption] = useState<SortOption>("default");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [genreMatchMode, setGenreMatchMode] = useState<"all" | "any">("all");

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

            // Fetch TMDB details for all watchlist items for runtime, genres, release date
            const detailsMap: Record<string, any> = {};
            await Promise.all(
              data.map(async (item: any) => {
                const type = item.content_type === "tv" ? "tv" : "movie";
                try {
                  const res = await fetch(`/api/tmdb?endpoint=${type}/${item.movie_id}&append_to_response=credits`);
                  if (res.ok) {
                    const d = await res.json();
                    detailsMap[`${type}_${item.movie_id}`] = d;
                    detailsMap[item.movie_id] = d;
                  }
                } catch { }
              })
            );
            setMediaDetails(detailsMap);
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

  const handleItemAdded = (item: any, detail?: any) => {
    setWatchlist((prev) => [item, ...prev]);
    if (detail) {
      const type = item.content_type === "tv" ? "tv" : "movie";
      setMediaDetails((prev) => ({
        ...prev,
        [`${type}_${item.movie_id}`]: detail,
        [item.movie_id]: detail,
      }));
    }
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const movieWatchlist = useMemo(
    () => watchlist.filter((item) => (item.content_type || "movie") !== "tv"),
    [watchlist]
  );
  const tvWatchlist = useMemo(
    () => watchlist.filter((item) => item.content_type === "tv"),
    [watchlist]
  );
  const currentList = activeTab === "movies" ? movieWatchlist : tvWatchlist;

  const getItemRuntime = (item: any, detail: any): number => {
    if (detail?.runtime && typeof detail.runtime === "number") return detail.runtime;
    if (Array.isArray(detail?.episode_run_time) && detail.episode_run_time[0]) return detail.episode_run_time[0];
    if (detail?.number_of_episodes) return detail.number_of_episodes * 45;
    return 0;
  };

  const getItemGenres = (item: any, detail: any): string[] => {
    const list: string[] = [];
    if (detail?.genres && Array.isArray(detail.genres)) {
      detail.genres.forEach((g: any) => {
        if (typeof g === "string") list.push(g);
        else if (g?.name) list.push(g.name);
      });
    }
    if (detail?.genre_ids && Array.isArray(detail.genre_ids)) {
      detail.genre_ids.forEach((id: number) => {
        const mapped = GENRE_MAP[id];
        if (mapped) list.push(mapped);
      });
    }
    return list;
  };

  // Combined Genre Filter and Sort
  const processedList = useMemo(() => {
    let list = [...currentList];

    // Filter by selected genres
    if (selectedGenres.length > 0) {
      list = list.filter((item) => {
        const type = item.content_type === "tv" ? "tv" : "movie";
        const detail = mediaDetails[`${type}_${item.movie_id}`] || mediaDetails[item.movie_id];
        const itemGenres = getItemGenres(item, detail);

        if (genreMatchMode === "all") {
          return selectedGenres.every((sg) =>
            itemGenres.some((ig) => ig.toLowerCase().includes(sg.toLowerCase()))
          );
        } else {
          return selectedGenres.some((sg) =>
            itemGenres.some((ig) => ig.toLowerCase().includes(sg.toLowerCase()))
          );
        }
      });
    }

    // Sort
    return list.sort((a, b) => {
      const typeA = a.content_type === "tv" ? "tv" : "movie";
      const typeB = b.content_type === "tv" ? "tv" : "movie";
      const detailA = mediaDetails[`${typeA}_${a.movie_id}`] || mediaDetails[a.movie_id];
      const detailB = mediaDetails[`${typeB}_${b.movie_id}`] || mediaDetails[b.movie_id];

      if (sortOption === "runtime_desc" || sortOption === "runtime_asc") {
        const runA = getItemRuntime(a, detailA);
        const runB = getItemRuntime(b, detailB);
        if (sortOption === "runtime_desc") {
          return runB - runA;
        } else {
          if (runA === 0 && runB === 0) return 0;
          if (runA === 0) return 1;
          if (runB === 0) return -1;
          return runA - runB;
        }
      }

      if (sortOption === "tmdb_desc" || sortOption === "tmdb_asc") {
        const voteA = detailA?.vote_average ?? 0;
        const voteB = detailB?.vote_average ?? 0;
        if (voteA !== voteB) {
          return sortOption === "tmdb_desc" ? voteB - voteA : voteA - voteB;
        }
      }

      if (sortOption === "year_desc" || sortOption === "year_asc") {
        const dateA = detailA?.release_date || detailA?.first_air_date || a.year || "";
        const dateB = detailB?.release_date || detailB?.first_air_date || b.year || "";
        const yearA = dateA ? parseInt(String(dateA).substring(0, 4), 10) || 0 : 0;
        const yearB = dateB ? parseInt(String(dateB).substring(0, 4), 10) || 0 : 0;
        if (yearA !== yearB) {
          return sortOption === "year_desc" ? yearB - yearA : yearA - yearB;
        }
      }

      if (sortOption === "title_asc") {
        const titleA = String(detailA?.title || detailA?.name || a.movie_title || "").toLowerCase();
        const titleB = String(detailB?.title || detailB?.name || b.movie_title || "").toLowerCase();
        const cmp = titleA.localeCompare(titleB);
        if (cmp !== 0) return cmp;
      }

      if (sortOption === "date_added_asc") {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeA - timeB;
      }

      // Default: date added descending
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });
  }, [currentList, selectedGenres, genreMatchMode, sortOption, mediaDetails]);

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
            {/* Top Toolbar: Search-to-add & Media Switcher */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              {/* Media Switcher: Movies vs TV */}
              <div className="flex items-center gap-2 p-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md self-start">
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

              {/* Watchlist Quick Search to Add */}
              <WatchlistSearchToAdd
                userId={user.id}
                watchlist={watchlist}
                onItemAdded={handleItemAdded}
                className="w-full md:w-96"
              />
            </div>

            {/* Sort Bar */}
            <div className="mb-4">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1">
                <span className="text-xs text-on-surface-variant uppercase tracking-widest font-semibold flex items-center gap-1 shrink-0 mr-1 opacity-70">
                  <span className="material-symbols-outlined text-[15px]">sort</span>
                  Sort:
                </span>
                {SORT_OPTIONS.map((opt) => {
                  const isActive = sortOption === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setSortOption(opt.id)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer border flex items-center gap-1 shrink-0 ${
                        isActive
                          ? activeTab === "tv"
                            ? "bg-purple-600 text-white border-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                            : "bg-[#e50914] text-white border-[#e50914] shadow-[0_0_12px_rgba(229,9,20,0.4)]"
                          : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {isActive && <span className="material-symbols-outlined text-[13px] font-bold">check</span>}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Multi-Genre Filter Row */}
            <div className="mb-6 p-3 rounded-2xl bg-white/[0.03] border border-white/10">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/50 uppercase tracking-widest font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">tune</span>
                    Genre Filter:
                  </span>
                  {selectedGenres.length > 0 && (
                    <span className="text-[11px] bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full font-bold">
                      {selectedGenres.length} selected
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Any / All Toggle */}
                  <div className="flex items-center bg-black/40 rounded-full p-0.5 border border-white/10 text-[11px]">
                    <button
                      onClick={() => setGenreMatchMode("all")}
                      className={`px-2.5 py-0.5 rounded-full font-semibold transition-all cursor-pointer ${
                        genreMatchMode === "all"
                          ? "bg-white/20 text-white"
                          : "text-white/40 hover:text-white"
                      }`}
                      title="Match ALL selected genres"
                    >
                      Match All
                    </button>
                    <button
                      onClick={() => setGenreMatchMode("any")}
                      className={`px-2.5 py-0.5 rounded-full font-semibold transition-all cursor-pointer ${
                        genreMatchMode === "any"
                          ? "bg-white/20 text-white"
                          : "text-white/40 hover:text-white"
                      }`}
                      title="Match ANY selected genre"
                    >
                      Match Any
                    </button>
                  </div>

                  {selectedGenres.length > 0 && (
                    <button
                      onClick={() => setSelectedGenres([])}
                      className="text-[11px] text-white/40 hover:text-white underline cursor-pointer bg-transparent border-none"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Genre Chips */}
              <div className="flex flex-wrap gap-1.5">
                {GENRE_LIST.map((genre) => {
                  const isSelected = selectedGenres.includes(genre);
                  return (
                    <button
                      key={genre}
                      onClick={() => toggleGenre(genre)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer border select-none ${
                        isSelected
                          ? "bg-primary text-black font-bold border-primary shadow-sm"
                          : "bg-white/5 text-white/60 border-white/10 hover:border-white/30 hover:text-white"
                      }`}
                    >
                      {genre}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Current Tab Grid or Empty State */}
            {processedList.length === 0 ? (
              <div className="text-center py-20 glass-card rounded-xl border border-white/10 max-w-md mx-auto animate-fade-in">
                <span className="material-symbols-outlined text-[48px] text-on-surface-variant/50 mb-4">
                  {selectedGenres.length > 0
                    ? "filter_alt_off"
                    : activeTab === "tv"
                    ? "tv_off"
                    : "bookmark_border"}
                </span>
                <h2 className="font-title-lg text-title-lg mb-2">
                  {selectedGenres.length > 0
                    ? "No matches for selected genres"
                    : activeTab === "tv"
                    ? "Your TV Show Watchlist is Empty"
                    : "Your Movie Watchlist is Empty"}
                </h2>
                <p className="text-on-surface-variant text-sm max-w-xs mx-auto mb-4">
                  {selectedGenres.length > 0
                    ? "Try loosening your genre filters or switching between Match All and Match Any."
                    : activeTab === "tv"
                    ? "Use the search bar above to bookmark your favorite TV shows."
                    : "Use the search bar above to bookmark your favorite movies."}
                </p>
                {selectedGenres.length > 0 && (
                  <button
                    onClick={() => setSelectedGenres([])}
                    className="bg-white/10 hover:bg-white/20 text-white text-xs px-4 py-2 rounded-full font-bold transition-all border border-white/10"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-stack-md animate-fade-in">
                {processedList.map((item: any) => {
                  const isTv = item.content_type === "tv";
                  const itemType = isTv ? "tv" : "movie";
                  const detail = mediaDetails[`${itemType}_${item.movie_id}`] || mediaDetails[item.movie_id];
                  const displayTitle = detail?.title || detail?.name || item.movie_title || "Untitled";
                  const linkHref = isTv ? getTvUrl(item.movie_id, displayTitle) : getMovieUrl(item.movie_id, displayTitle);
                  const displayPoster =
                    posterPrefs[`${itemType}_${item.movie_id}`] ??
                    posterPrefs[String(item.movie_id)] ??
                    item.poster_path;
                  const runtime = getItemRuntime(item, detail);

                  return (
                    <Link
                      key={`${itemType}_${item.id || item.movie_id}`}
                      href={linkHref}
                      className="group cursor-pointer block relative"
                    >
                      <div className="aspect-[2/3] rounded-xl overflow-hidden border border-white/10 relative mb-2 bg-white/5">
                        <img
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          alt={displayTitle}
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

                        {/* Runtime badge */}
                        {runtime > 0 && (
                          <div className="absolute bottom-2 right-2">
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-md border border-white/10 text-white/90">
                              {runtime}m
                            </span>
                          </div>
                        )}
                      </div>
                      <h4 className="text-body-md font-bold truncate group-hover:text-primary transition-colors">
                        {displayTitle}
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
