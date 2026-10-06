"use client";

import React, { useState, useEffect, useCallback } from "react";

interface PosterItem {
  path: string;
  lang: string | null; // iso_639_1 from TMDB; null = textless
}

interface PosterPickerModalProps {
  movieId: string;
  movieTitle: string;
  currentPosterPath: string | null;
  defaultPosterPath: string | null;
  userId: string;
  contentType?: "movie" | "tv";
  onClose: () => void;
  onSelect: (posterPath: string | null) => void;
}

export default function PosterPickerModal({
  movieId,
  movieTitle,
  currentPosterPath,
  defaultPosterPath,
  userId,
  contentType = "movie",
  onClose,
  onSelect,
}: PosterPickerModalProps) {
  const [posters, setPosters] = useState<PosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string | null>(currentPosterPath);
  const [error, setError] = useState<string | null>(null);

  // Fetch TMDB images for this movie / TV show
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Request a broad language set so we get genuinely different artwork:
    //   null  = textless/international posters (most visually distinct)
    //   en    = English-text posters
    //   + a handful of other major languages to catch regional exclusive art
    const langParam = "include_image_language=en%2Cnull%2Cja%2Cko%2Cfr%2Cde%2Ces%2Cit%2Cpt";
    fetch(`/api/tmdb?endpoint=${contentType}/${movieId}/images&${langParam}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.posters && Array.isArray(data.posters)) {
          const raw: any[] = data.posters.filter((p: any) => p.file_path);

          // --- Deduplication + ranking ---
          // Strategy: bucket posters by their (width × height) fingerprint.
          // Multiple language variants of the same base art almost always share
          // identical dimensions. Keep the "best" representative of each bucket:
          //   tier 0 = textless (iso_639_1 === null)
          //   tier 1 = English  (iso_639_1 === "en")
          //   tier 2 = everything else
          // Within a bucket, pick the lowest tier (most preferred), then highest vote_average.
          // Across buckets, sort: tier 0 first, then tier 1, then tier 2;
          // within the same tier, descending vote_average.

          const tierOf = (p: any): number => {
            if (p.iso_639_1 === null) return 0;
            if (p.iso_639_1 === "en") return 1;
            return 2;
          };

          // Build dimension-keyed buckets
          const buckets = new Map<string, any>();
          for (const p of raw) {
            const key = `${p.width ?? 0}x${p.height ?? 0}`;
            const existing = buckets.get(key);
            if (!existing) {
              buckets.set(key, p);
            } else {
              // Replace if this poster is more preferred
              const better =
                tierOf(p) < tierOf(existing) ||
                (tierOf(p) === tierOf(existing) && (p.vote_average ?? 0) > (existing.vote_average ?? 0));
              if (better) buckets.set(key, p);
            }
          }

          // Sort deduplicated posters
          const deduplicated = Array.from(buckets.values()).sort((a, b) => {
            const ta = tierOf(a);
            const tb = tierOf(b);
            if (ta !== tb) return ta - tb;
            return (b.vote_average ?? 0) - (a.vote_average ?? 0);
          });

          const sortedItems: PosterItem[] = deduplicated.slice(0, 20).map((p: any) => ({
            path: p.file_path as string,
            lang: p.iso_639_1 ?? null,
          }));

          // Always put the default poster first if not already present
          if (defaultPosterPath && !sortedItems.find(p => p.path === defaultPosterPath)) {
            sortedItems.unshift({ path: defaultPosterPath, lang: "en" });
          }
          setPosters(sortedItems);
        } else {
          setPosters(defaultPosterPath ? [{ path: defaultPosterPath, lang: "en" }] : []);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load poster options.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [movieId, defaultPosterPath, contentType]);

  // Close on backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (!selected || selected === defaultPosterPath) {
        // Reset: delete preference
        await fetch(`/api/poster-preference?userId=${encodeURIComponent(userId)}&movieId=${encodeURIComponent(movieId)}&contentType=${encodeURIComponent(contentType)}&defaultPosterPath=${encodeURIComponent(defaultPosterPath || "")}`, {
          method: "DELETE",
        });
        onSelect(null);
      } else {
        await fetch("/api/poster-preference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, movie_id: movieId, content_type: contentType, poster_path: selected }),
        });
        onSelect(selected);
      }
      onClose();
    } catch {
      setError("Failed to save poster preference. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSelected(defaultPosterPath);
    if (saving) return;
    setSaving(true);
    try {
      await fetch(`/api/poster-preference?userId=${encodeURIComponent(userId)}&movieId=${encodeURIComponent(movieId)}&contentType=${encodeURIComponent(contentType)}&defaultPosterPath=${encodeURIComponent(defaultPosterPath || "")}`, {
        method: "DELETE",
      });
      onSelect(null);
      onClose();
    } catch {
      setError("Failed to reset. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const isCustomized = currentPosterPath && currentPosterPath !== defaultPosterPath;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.8)] overflow-hidden"
        style={{ background: "linear-gradient(135deg, #131313 0%, #1a1a1a 100%)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-white/10 flex-shrink-0">
          <div>
            <h2 className="font-serif text-2xl text-[#e5e2e1] leading-tight">Choose Poster</h2>
            <p className="text-sm text-white/50 mt-1 truncate max-w-[380px]">{movieTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all cursor-pointer border border-white/10 flex-shrink-0 ml-4"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Poster Grid */}
        <div className="flex-1 overflow-y-auto px-6 py-5 no-scrollbar">
          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] rounded-xl bg-white/10 animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/40 gap-3">
              <span className="material-symbols-outlined text-[40px]">error_outline</span>
              <p className="text-sm">{error}</p>
            </div>
          ) : posters.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/40 gap-3">
              <span className="material-symbols-outlined text-[40px]">image_not_supported</span>
              <p className="text-sm">No alternate posters available</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {posters.map((poster, i) => {
                const isSelected = selected === poster.path;
                const isDefault = poster.path === defaultPosterPath;
                const isTextless = poster.lang === null;
                return (
                  <button
                    key={i}
                    onClick={() => setSelected(poster.path)}
                    className={`relative aspect-[2/3] rounded-xl overflow-hidden border-2 transition-all duration-200 cursor-pointer focus:outline-none group ${
                      isSelected
                        ? "border-[#ffb4aa] shadow-[0_0_20px_rgba(255,180,170,0.4)] scale-[1.03]"
                        : "border-white/10 hover:border-white/30 hover:scale-[1.02]"
                    }`}
                  >
                    <img
                      src={`https://image.tmdb.org/t/p/w342${poster.path}`}
                      alt={`Poster option ${i + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {/* Language / Textless badge — top-left */}
                    {isTextless && !isDefault && (
                      <div className="absolute top-1.5 left-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-black/70 text-emerald-400 border border-emerald-400/30">
                          Textless
                        </span>
                      </div>
                    )}
                    {/* Selected check */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-[#ffb4aa]/10 flex items-start justify-end p-2">
                        <div className="w-6 h-6 rounded-full bg-[#ffb4aa] flex items-center justify-center shadow-lg">
                          <span className="material-symbols-outlined text-black text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                        </div>
                      </div>
                    )}
                    {/* Default badge */}
                    {isDefault && (
                      <div className="absolute bottom-0 left-0 right-0 py-1 px-2 bg-black/70 text-center">
                        <span className="text-[9px] uppercase tracking-widest text-white/60 font-bold">Default</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/10 flex-shrink-0">
          {isCustomized ? (
            <button
              onClick={handleReset}
              disabled={saving}
              className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors cursor-pointer disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
              Reset to default
            </button>
          ) : (
            <span className="text-xs text-white/30 italic">Select a poster from the grid</span>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-full text-sm text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || (!selected && !isCustomized)}
              className="px-5 py-2 rounded-full text-sm font-bold bg-[#ffb4aa] text-black hover:brightness-110 transition-all active:scale-95 cursor-pointer disabled:opacity-40 flex items-center gap-2"
            >
              {saving && <span className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />}
              Apply Poster
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
