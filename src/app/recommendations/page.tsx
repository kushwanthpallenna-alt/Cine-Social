"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProvider";
import NotificationBell from "@/components/NotificationBell";


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

const MOOD_MAPPING: Record<string, { endpoint: string, query: string }> = {
  "Melancholic": { endpoint: "discover/movie", query: "&with_genres=18&sort_by=vote_average.desc&vote_count.gte=500" },
  "Adrenaline Rush": { endpoint: "discover/movie", query: "&with_genres=28,53&sort_by=popularity.desc" },
  "Mind-Bending": { endpoint: "discover/movie", query: "&with_genres=878,9648&sort_by=vote_average.desc&vote_count.gte=500" },
  "Cyberpunk Noir": { endpoint: "discover/movie", query: "&with_genres=878,80&sort_by=popularity.desc" },
  "Existential": { endpoint: "discover/movie", query: "&with_genres=18,878&sort_by=vote_average.desc&vote_count.gte=500" },
};

export default function Recommendations() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set());
  const [watchlistLoadingId, setWatchlistLoadingId] = useState<string | null>(null);
  const { showToast } = useToast();

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

  // Watchlist Toggle with optimistic updates
  const handleWatchlistToggle = async (movie: any) => {
    if (!user) return;
    const movieIdStr = String(movie.id);
    const isSaved = watchlistIds.has(movieIdStr);
    
    setWatchlistLoadingId(movieIdStr);
    
    // Optimistic update
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
          setWatchlistIds(watchlistIds);
          console.error("Error inserting into watchlist:", error);
          showToast("Failed to update watchlist");
        } else {
          showToast("Added to watchlist!");
        }
      }
    } catch (err) {
      setWatchlistIds(watchlistIds);
      console.error("Error toggling watchlist:", err);
    } finally {
      setWatchlistLoadingId(null);
    }
  };
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [selectedMood, setSelectedMood] = useState("Melancholic");
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const [moodMovies, setMoodMovies] = useState<any[]>([]);
  const [loadingMood, setLoadingMood] = useState(false);

  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'model', text: string}[]>([
    {
      role: 'user',
      text: "I'm looking for something that feels like Interstellar but with a darker, more philosophical edge."
    },
    {
      role: 'model',
      text: "Understood. Analyzing your preference for high-concept Sci-Fi and existential themes. Based on your love for Nolan's visual scale and Tarkovsky's pacing, I've curated these experiences for you."
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setChatHistory(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, history: chatHistory })
      });
      const data = await res.json();
      if (res.ok) {
        setChatHistory(prev => [...prev, { role: 'model', text: data.text }]);
      } else {
        setChatHistory(prev => [...prev, { role: 'model', text: `Error: ${data.error || data.text}` }]);
      }
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'model', text: "Network error occurred." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      setMousePos({ x, y });
    };

    if (typeof window !== "undefined" && window.innerWidth > 768) {
      window.addEventListener("mousemove", handleMouseMove);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("mousemove", handleMouseMove);
      }
    };
  }, []);

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
        console.error("Error searching movies and TV shows:", err);
      } finally {
        setSearching(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const moods = [
    "Melancholic",
    "Adrenaline Rush",
    "Mind-Bending",
    "Cyberpunk Noir",
    "Existential",
  ];

  useEffect(() => {
    const fetchMoodMovies = async () => {
      setLoadingMood(true);
      try {
        const mapping = MOOD_MAPPING[selectedMood] || MOOD_MAPPING["Melancholic"];
        const res = await fetch(`/api/tmdb?endpoint=${mapping.endpoint}${mapping.query}`);
        const data = await res.json();
        if (data.results) {
          setMoodMovies(data.results.slice(0, 4));
        }
      } catch (err) {
        console.error("Error fetching mood movies:", err);
      } finally {
        setLoadingMood(false);
      }
    };
    fetchMoodMovies();
  }, [selectedMood]);

  return (
    <div className="font-body-md text-body-md bg-[#050505] text-[#e5e2e1] min-h-screen relative pb-32 overflow-x-clip">
      <div
        className="animated-bg"
        style={{
          background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(229, 9, 20, 0.08) 0%, transparent 60%)`,
        }}
      />

      {/* TopAppBar */}
      <header className="fixed top-0 left-0 w-full z-50 bg-[#131313]/60 backdrop-blur-[40px] border-b border-white/10 shadow-[0_8px_32px_0_rgba(255,180,170,0.05)] flex justify-between items-center px-container-margin py-stack-md">
        <div className="flex items-center gap-stack-md">
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-10 h-10 rounded-full bg-surface-container overflow-hidden border border-white/10 hover:opacity-80 transition-all focus:outline-none cursor-pointer flex items-center justify-center bg-white/5"
            >
              <img
                alt={user?.name || "Profile"}
                className="w-full h-full object-cover"
                src={user?.image || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}
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
            <h1 className="font-display-md text-display-md text-primary tracking-tighter select-none font-serif">
              CINE SOCIAL
            </h1>
          </Link>
        </div>
        <div className="flex items-center gap-stack-md">
          <NotificationBell />
        </div>
      </header>

      <main className="pt-[100px] pb-[120px] px-container-margin max-w-[1440px] mx-auto space-y-stack-xl relative z-10">
        {/* CineAI Assistant Header */}
        <section className="text-center space-y-stack-sm">
          <h2 className="font-display-lg text-display-lg pulsing-glow text-primary-fixed leading-none font-serif">
            CineAI Assistant
          </h2>
          <p className="text-on-surface-variant font-body-lg text-body-lg max-w-lg mx-auto opacity-70">
            Your personal cinematic curator, powered by deep neural narrative analysis.
          </p>
        </section>

        {/* Dynamic Search Bar */}
        <section className="max-w-2xl mx-auto w-full">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60">
              search
            </span>
            <input
              type="text"
              placeholder="Search for movies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-full py-4 pl-12 pr-12 text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all duration-300 font-body-md"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-primary transition-colors cursor-pointer border-none bg-transparent"
              >
                close
              </button>
            )}
          </div>
        </section>

        {searchQuery.trim() !== "" ? (
          <section className="space-y-stack-md max-w-[1200px] mx-auto w-full">
            <div className="flex justify-between items-center mb-stack-md">
              <h3 className="font-title-lg text-title-lg font-serif">
                Search Results for "{searchQuery}"
              </h3>
            </div>

            {searching ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-stack-md">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="min-w-[140px] animate-pulse">
                    <div className="aspect-[2/3] rounded-xl bg-white/5 mb-stack-sm"></div>
                    <div className="h-4 bg-white/10 rounded w-3/4 mb-1"></div>
                    <div className="h-3 bg-white/10 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : searchResults.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-stack-md">
                {searchResults.map((item: any) => {
                  const isTv = item.media_type === "tv" || (item.name && !item.title);
                  const rating = item.vote_average ? item.vote_average.toFixed(1) : "N/A";
                  const dateStr = item.release_date || item.first_air_date || "";
                  const year = dateStr ? new Date(dateStr).getFullYear() : "";
                  const genres = item.genre_ids ? item.genre_ids.slice(0, 2).map((id: number) => GENRE_MAP[id]).filter(Boolean).join(", ") : "";
                  const isSaved = watchlistIds.has(String(item.id));
                  const isLoading = watchlistLoadingId === String(item.id);

                  return (
                    <div key={item.id} className="group/card relative block animate-fade-in">
                      <Link href={isTv ? `/tv?id=${item.id}` : `/movies?id=${item.id}`} className="cursor-pointer block">
                        <div className="aspect-[2/3] rounded-lg overflow-hidden border border-white/5 relative mb-2 bg-white/5">
                          <img
                            className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
                            alt={item.title || item.name || "Poster"}
                            src={item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500"}
                          />
                          <span className={`absolute top-2 left-2 z-10 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded backdrop-blur-md shadow-md ${isTv ? "bg-purple-600/90 text-white border border-purple-400/30" : "bg-primary/90 text-black border border-primary/30"}`}>
                            {isTv ? "TV Show" : "Movie"}
                          </span>
                          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black to-transparent"></div>
                          <div className="absolute bottom-2 left-2 flex items-center gap-1 text-secondary text-[10px]">
                            <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                              star
                            </span>
                            {rating}
                          </div>
                        </div>
                        <span className="block text-body-md font-bold truncate group-hover/card:text-primary transition-colors">{item.title || item.name}</span>
                        <span className="block text-label-sm text-on-surface-variant opacity-60 truncate">
                          {year ? `${year} • ` : ""}{genres}
                        </span>
                      </Link>

                      {/* Bookmark Button Overlay */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleWatchlistToggle(item);
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
            ) : (
              <div className="text-center py-12 glass rounded-xl border-white/5">
                <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40 mb-2">
                  search_off
                </span>
                <p className="text-on-surface-variant text-body-lg">No movies found matching "{searchQuery}"</p>
              </div>
            )}
          </section>
        ) : (
          <>
            {/* Taste Analysis (DNA Card) */}
            <section className="flex justify-center">
              <div className="glass glass-glow rounded-xl p-stack-md flex items-center gap-gutter border-secondary/20 max-w-sm w-full">
                <div className="relative w-12 h-12 flex-shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="24" cy="24" fill="transparent" r="20" stroke="rgba(255,255,255,0.1)" strokeWidth="4"></circle>
                    <circle
                      cx="24"
                      cy="24"
                      fill="transparent"
                      r="20"
                      stroke="#e50914"
                      strokeDasharray="125.6"
                      strokeDashoffset="25.1"
                      strokeWidth="4"
                    ></circle>
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">80%</span>
                </div>
                <div>
                  <h3 className="font-title-lg text-title-lg text-secondary">Your Cinema DNA</h3>
                  <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-widest">
                    80% Sci-Fi, 10% Noir, 10% Drama
                  </p>
                </div>
              </div>
            </section>

            {/* Mood Selector */}
            <section className="space-y-stack-md">
              <div className="flex items-center justify-between">
                <h4 className="font-title-lg text-title-lg">Current Mood</h4>
                <span className="text-label-sm font-label-sm text-primary uppercase cursor-pointer">Edit Filter</span>
              </div>
              <div className="flex overflow-x-auto gap-stack-md scrollbar-hide py-2">
                {moods.map((mood) => (
                  <button
                    key={mood}
                    onClick={() => setSelectedMood(mood)}
                    className={`flex-shrink-0 px-stack-md py-stack-sm rounded-full font-label-sm text-label-sm transition-all cursor-pointer ${
                      selectedMood === mood
                        ? "bg-primary-container text-on-primary-container"
                        : "glass text-on-surface border-white/5 hover:border-primary/40"
                    }`}
                  >
                    {mood}
                  </button>
                ))}
              </div>
            </section>

            {/* AI Chat UI */}
            <section className="space-y-stack-lg max-w-2xl mx-auto">
              <div className="space-y-stack-md max-h-[60vh] overflow-y-auto pr-2 no-scrollbar">
                {chatHistory.map((msg, idx) => (
                  msg.role === 'user' ? (
                    <div key={idx} className="flex justify-end">
                      <div className="glass px-stack-md py-stack-sm rounded-[20px] rounded-tr-none max-w-[80%]">
                        <p className="text-body-md font-body-md text-on-surface-variant whitespace-pre-wrap">
                          {msg.text}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div key={idx} className="flex justify-start gap-stack-sm">
                      <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container flex-shrink-0 self-end">
                        <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                      </div>
                      <div className="glass bg-white/5 px-stack-md py-stack-sm rounded-[20px] rounded-tl-none max-w-[80%] border-primary/20">
                        <p className="text-body-md font-body-md whitespace-pre-wrap">
                          {msg.text}
                        </p>
                      </div>
                    </div>
                  )
                ))}
                
                {isChatLoading && (
                  <div className="flex justify-start gap-stack-sm">
                    <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container flex-shrink-0 self-end">
                      <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                    </div>
                    <div className="glass bg-white/5 px-stack-md py-stack-sm rounded-[20px] rounded-tl-none border-primary/20 flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse delay-75"></div>
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse delay-150"></div>
                    </div>
                  </div>
                )}
              </div>
              
              <form onSubmit={handleSendMessage} className="relative mt-4">
                <input
                  type="text"
                  placeholder="Ask CineAI for movie recommendations..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isChatLoading}
                  className="w-full bg-white/5 border border-white/10 rounded-full py-3 pl-6 pr-12 text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-body-md"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isChatLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-primary text-black flex items-center justify-center disabled:opacity-50 transition-opacity cursor-pointer border-none"
                >
                  <span className="material-symbols-outlined text-sm">send</span>
                </button>
              </form>
            </section>

            {/* Recommendation Cards (Bento Grid) */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-stack-lg">
              {loadingMood ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="glass relative rounded-xl aspect-[16/9] overflow-hidden animate-pulse bg-white/5 border border-white/5"></div>
                ))
              ) : moodMovies.length > 0 ? (
                moodMovies.map((movie: any, idx: number) => {
                  const isSaved = watchlistIds.has(String(movie.id));
                  const isLoading = watchlistLoadingId === String(movie.id);

                  return (
                    <div key={movie.id} className="relative group/card rounded-xl overflow-hidden">
                      <Link href={`/movies?id=${movie.id}`} className="glass relative overflow-hidden cursor-pointer transition-all hover:scale-[1.02] block border border-white/10 w-full h-full">
                        <div className="aspect-[16/9] w-full overflow-hidden relative">
                          <img
                            className="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-110"
                            alt={movie.title || movie.name}
                            src={movie.backdrop_path ? `https://image.tmdb.org/t/p/w780${movie.backdrop_path}` : "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800"}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                        </div>
                        <div className="p-stack-md space-y-stack-sm absolute bottom-0 left-0 right-0 z-10">
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] font-label-sm text-primary uppercase tracking-widest bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-md">
                              {idx === 0 ? "Top Match" : "Recommended"}
                            </span>
                            <div className="flex gap-1 bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-md items-center">
                              <span className="material-symbols-outlined text-secondary text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                star
                              </span>
                              <span className="text-[10px] font-label-sm text-white">{movie.vote_average ? movie.vote_average.toFixed(1) : "N/A"}</span>
                            </div>
                          </div>
                          <h5 className="font-title-lg text-title-lg text-white line-clamp-1 text-shadow-sm">{movie.title || movie.name}</h5>
                          <p className="text-body-sm font-body-sm text-white/80 line-clamp-2 text-shadow-sm hidden md:block">
                            {movie.overview}
                          </p>
                          <div className="flex gap-stack-sm pt-1">
                            {movie.genre_ids && movie.genre_ids.slice(0, 2).map((id: number) => (
                              <span key={id} className="px-2 py-1 bg-white/10 backdrop-blur-md border border-white/10 rounded-md text-[9px] font-bold uppercase text-white/90">
                                {GENRE_MAP[id]}
                              </span>
                            ))}
                          </div>
                        </div>
                      </Link>

                      {/* Bookmark Button Overlay */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleWatchlistToggle(movie);
                        }}
                        disabled={isLoading}
                        className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md flex items-center justify-center text-white border border-white/10 transition-all duration-200 cursor-pointer shadow-lg hover:scale-110 active:scale-95 group-hover/card:opacity-100 md:opacity-0"
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
                <p className="text-on-surface-variant">No recommendations found for this mood.</p>
              )}
            </section>
          </>
        )}
      </main>

      {/* FAB: AI Re-analyze */}
      <button className="fixed bottom-24 right-container-margin w-14 h-14 rounded-full bg-gradient-to-br from-secondary to-primary shadow-lg flex items-center justify-center z-50 transition-transform active:scale-90 hover:shadow-primary/20 cursor-pointer border-none">
        <span className="material-symbols-outlined text-on-primary text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
          psychology
        </span>
      </button>

      {/* BottomNavBar */}
      <nav className="fixed bottom-0 left-0 right-0 h-[60px] z-50 mb-container-margin mx-container-margin rounded-full bg-surface/40 backdrop-blur-[100px] border border-white/10 shadow-[0_0_20px_rgba(255,180,170,0.1)] flex justify-around items-center w-full px-6 max-w-md md:left-1/2 md:-translate-x-1/2">
        <Link
          className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90 transition-all"
          href="/"
        >
          <span className="material-symbols-outlined">home</span>
        </Link>
        <Link
          className="flex items-center justify-center text-primary relative after:content-[''] after:absolute after:-bottom-2 after:w-1 after:h-1 after:bg-primary after:rounded-full after:shadow-[0_0_8px_#ffb4aa] active:scale-90 transition-all"
          href="/recommendations"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            search
          </span>
        </Link>
        <Link
          className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90 transition-all"
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
