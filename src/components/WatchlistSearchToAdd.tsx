"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface WatchlistSearchToAddProps {
  userId: string;
  watchlist: any[];
  onItemAdded: (item: any, detail?: any) => void;
  className?: string;
}

export default function WatchlistSearchToAdd({
  userId,
  watchlist,
  onItemAdded,
  className = "",
}: WatchlistSearchToAddProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced TMDB search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/tmdb?endpoint=search/multi&query=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          const filtered = (data.results || []).filter(
            (item: any) => item.media_type === "movie" || item.media_type === "tv"
          );
          setResults(filtered.slice(0, 8));
          setIsOpen(true);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const isAlreadyInWatchlist = (item: any) => {
    const itemContentType = item.media_type === "tv" ? "tv" : "movie";
    return watchlist.some(
      (w) =>
        String(w.movie_id) === String(item.id) &&
        (w.content_type || "movie") === itemContentType
    );
  };

  const handleAdd = async (item: any) => {
    if (!userId || addingId) return;
    const contentType = item.media_type === "tv" ? "tv" : "movie";
    const title = item.title || item.name || "Untitled";

    if (isAlreadyInWatchlist(item)) {
      showToast(`"${title}" is already in your watchlist!`);
      return;
    }

    setAddingId(item.id);
    try {
      const newItem = {
        user_id: userId,
        movie_id: item.id,
        movie_title: title,
        poster_path: item.poster_path || "",
        content_type: contentType,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("watchlist")
        .insert(newItem)
        .select()
        .single();

      if (error) {
        console.error("Error adding to watchlist:", error);
        showToast("Failed to add to watchlist. Please try again.");
      } else {
        // Fetch detailed TMDB info for instant genre & runtime support
        let detailData = null;
        try {
          const dRes = await fetch(`/api/tmdb?endpoint=${contentType}/${item.id}&append_to_response=credits`);
          if (dRes.ok) {
            detailData = await dRes.json();
          }
        } catch { }

        onItemAdded(data || newItem, detailData);
        showToast(`Added "${title}" to your ${contentType === "tv" ? "TV Shows" : "Movies"} watchlist!`);
        setQuery("");
        setIsOpen(false);
      }
    } catch (err) {
      console.error("Error inserting to watchlist:", err);
      showToast("Something went wrong.");
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full max-w-md ${className}`}>
      {/* Toast popup */}
      {toastMessage && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-50 bg-[#1e1e1e] border border-white/20 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-2xl backdrop-blur-md animate-fade-in flex items-center gap-2 whitespace-nowrap">
          <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
          {toastMessage}
        </div>
      )}

      {/* Input bar */}
      <div className="relative flex items-center">
        <span className="material-symbols-outlined absolute left-3.5 text-white/40 text-[18px] pointer-events-none">
          search
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder="Search movies & TV shows to add..."
          className="w-full pl-10 pr-10 py-2.5 rounded-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-primary/60 focus:bg-white/10 focus:outline-none text-white text-sm placeholder-white/30 transition-all shadow-inner"
        />
        {loading ? (
          <div className="absolute right-3.5 w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        ) : query ? (
          <button
            onClick={() => {
              setQuery("");
              setIsOpen(false);
            }}
            className="absolute right-3 text-white/40 hover:text-white p-1"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        ) : null}
      </div>

      {/* Dropdown Results */}
      {isOpen && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-[#141414] border border-white/15 rounded-2xl shadow-2xl overflow-hidden z-50 max-h-96 overflow-y-auto divide-y divide-white/5 animate-fade-in">
          <div className="px-3 py-2 text-[10px] uppercase font-bold tracking-wider text-white/40 bg-white/[0.02]">
            Search Results (Click to add)
          </div>
          {results.map((item) => {
            const isTv = item.media_type === "tv";
            const title = item.title || item.name || "Untitled";
            const date = item.release_date || item.first_air_date || "";
            const year = date ? date.substring(0, 4) : "";
            const inWatchlist = isAlreadyInWatchlist(item);
            const isAdding = addingId === item.id;

            return (
              <div
                key={`${item.media_type}_${item.id}`}
                onClick={() => !inWatchlist && !isAdding && handleAdd(item)}
                className={`flex items-center gap-3 p-2.5 hover:bg-white/5 transition-colors cursor-pointer select-none ${
                  inWatchlist ? "opacity-60 cursor-default" : ""
                }`}
              >
                {/* Poster */}
                <div className="w-10 h-14 rounded-md overflow-hidden bg-white/10 shrink-0 border border-white/10">
                  {item.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
                      alt={title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20">
                      <span className="material-symbols-outlined text-[18px]">
                        {isTv ? "tv" : "movie"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                        isTv
                          ? "bg-purple-950/80 text-purple-300 border border-purple-500/30"
                          : "bg-red-950/80 text-red-300 border border-red-500/30"
                      }`}
                    >
                      {isTv ? "TV" : "Movie"}
                    </span>
                    <span className="text-white text-xs font-semibold truncate">
                      {title}
                    </span>
                  </div>
                  {year && (
                    <span className="text-[11px] text-white/40 mt-0.5 block">
                      {year}
                    </span>
                  )}
                </div>

                {/* Action button */}
                <div className="shrink-0">
                  {inWatchlist ? (
                    <span className="text-[11px] text-green-400 font-medium flex items-center gap-1 bg-green-500/10 px-2 py-1 rounded-full border border-green-500/20">
                      <span className="material-symbols-outlined text-[14px]">check</span>
                      Added
                    </span>
                  ) : isAdding ? (
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <button
                      type="button"
                      className="text-xs bg-white/10 hover:bg-primary hover:text-black text-white font-semibold px-2.5 py-1 rounded-full border border-white/10 transition-all flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      Add
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
