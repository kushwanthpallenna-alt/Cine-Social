"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";

interface RatingItem {
  id?: string;
  movie_id: string | number;
  rating: number;
  content_type?: string;
  created_at?: string;
}

interface RatingDistributionChartProps {
  ratings: RatingItem[];
  mediaDetails: Record<string, any>;
  className?: string;
}

const RATING_STEPS = [
  0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0,
  5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0,
];

export default function RatingDistributionChart({
  ratings = [],
  mediaDetails = {},
  className = "",
}: RatingDistributionChartProps) {
  const [activeTab, setActiveTab] = useState<"movie" | "tv">("movie");
  const [selectedRating, setSelectedRating] = useState<number | null>(null);

  // Split ratings into movies and tv
  const movieRatings = useMemo(() => {
    return ratings.filter((r) => !r.content_type || r.content_type === "movie");
  }, [ratings]);

  const tvRatings = useMemo(() => {
    return ratings.filter((r) => r.content_type === "tv");
  }, [ratings]);

  const currentRatings = activeTab === "tv" ? tvRatings : movieRatings;

  // Compute distribution histogram buckets
  const { distribution, maxCount, averageRating, totalCount } = useMemo(() => {
    const counts: Record<number, number> = {};
    RATING_STEPS.forEach((step) => {
      counts[step] = 0;
    });

    let sum = 0;
    let count = 0;

    currentRatings.forEach((item) => {
      const val = Number(item.rating);
      if (!isNaN(val) && val > 0) {
        // Round to nearest 0.5 increment
        const snapped = Math.round(val * 2) / 2;
        if (counts[snapped] !== undefined) {
          counts[snapped] += 1;
        } else if (snapped <= 10 && snapped >= 0.5) {
          counts[snapped] = (counts[snapped] || 0) + 1;
        }
        sum += val;
        count += 1;
      }
    });

    const max = Math.max(...Object.values(counts), 1);
    const avg = count > 0 ? (sum / count).toFixed(1) : "0.0";

    return {
      distribution: counts,
      maxCount: max,
      averageRating: avg,
      totalCount: count,
    };
  }, [currentRatings]);

  // Filtered items when a bar is clicked
  const filteredItems = useMemo(() => {
    if (selectedRating === null) return [];
    return currentRatings.filter((item) => {
      const val = Number(item.rating);
      const snapped = Math.round(val * 2) / 2;
      return snapped === selectedRating;
    });
  }, [currentRatings, selectedRating]);

  const handleBarClick = (step: number) => {
    if (selectedRating === step) {
      setSelectedRating(null); // toggle off
    } else {
      setSelectedRating(step);
    }
  };

  return (
    <div className={`glass-panel p-6 rounded-2xl border border-white/10 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
              bar_chart
            </span>
            <h3 className="font-serif text-lg font-bold text-on-surface tracking-tight">
              Ratings Distribution
            </h3>
          </div>
          <p className="text-xs text-on-surface-variant opacity-60 mt-0.5">
            {totalCount} {activeTab === "tv" ? "TV show" : "film"}{totalCount === 1 ? "" : "s"} rated &bull; Average: <span className="text-primary font-bold">{averageRating}</span>/10
          </p>
        </div>

        {/* Media Filter Tabs */}
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/10 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab("movie");
              setSelectedRating(null);
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "movie"
                ? "bg-primary text-black shadow-md shadow-primary/20"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Films ({movieRatings.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("tv");
              setSelectedRating(null);
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "tv"
                ? "bg-primary text-black shadow-md shadow-primary/20"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            TV Shows ({tvRatings.length})
          </button>
        </div>
      </div>

      {/* Histogram Section */}
      {totalCount === 0 ? (
        <div className="py-10 text-center text-on-surface-variant opacity-50 text-sm">
          No {activeTab === "tv" ? "TV show" : "film"} ratings logged yet.
        </div>
      ) : (
        <div>
          {/* Chart Container */}
          <div className="flex items-end gap-1 sm:gap-1.5 h-32 px-1 pt-6 pb-2 relative">
            {/* Left Star Indicator */}
            <div className="flex flex-col items-center justify-end h-full pb-1 pr-1 text-on-surface-variant/40 shrink-0">
              <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
                star_half
              </span>
              <span className="text-[9px] font-mono">0.5</span>
            </div>

            {/* Bars */}
            <div className="flex-1 flex items-end justify-between gap-[2px] sm:gap-1 h-full">
              {RATING_STEPS.map((step) => {
                const count = distribution[step] || 0;
                const heightPercent = count > 0 ? Math.max((count / maxCount) * 100, 10) : 4;
                const isSelected = selectedRating === step;
                const hasRatings = count > 0;

                return (
                  <div
                    key={step}
                    onClick={() => handleBarClick(step)}
                    className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                    title={`${step}★: ${count} ${activeTab === "tv" ? "show" : "film"}${count === 1 ? "" : "s"}`}
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#1a1a1a] text-on-surface border border-white/15 px-2 py-0.5 rounded text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30 shadow-lg">
                      <span className="text-secondary font-bold font-serif">{step}★</span> &bull; {count}
                    </div>

                    {/* Bar element */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t-sm transition-all duration-300 relative ${
                        isSelected
                          ? "bg-gradient-to-t from-primary to-secondary shadow-[0_0_12px_rgba(255,180,170,0.6)] brightness-125"
                          : hasRatings
                          ? "bg-white/30 group-hover:bg-primary/80 group-hover:shadow-[0_0_8px_rgba(255,180,170,0.4)]"
                          : "bg-white/5 group-hover:bg-white/10"
                      }`}
                    />

                    {/* Subtle dot or tick for whole numbers */}
                    {step % 1 === 0 && (
                      <span
                        className={`text-[8px] font-mono mt-1 ${
                          isSelected
                            ? "text-primary font-bold"
                            : "text-on-surface-variant/40 group-hover:text-on-surface-variant/80"
                        }`}
                      >
                        {step}
                      </span>
                    )}
                    {step % 1 !== 0 && (
                      <span className="h-[12px] w-[1px] bg-transparent mt-1" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Right Star Indicator */}
            <div className="flex flex-col items-center justify-end h-full pb-1 pl-1 text-on-surface-variant/40 shrink-0">
              <span className="material-symbols-outlined text-xs text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
                star
              </span>
              <span className="text-[9px] font-mono text-secondary">10</span>
            </div>
          </div>

          {/* Interactive Hint / Selection prompt */}
          <div className="text-center mt-2">
            <span className="text-[11px] text-on-surface-variant/50">
              {selectedRating !== null
                ? `Showing items rated ${selectedRating}★ (click bar again to reset)`
                : "Click any bar to filter films or shows by that exact rating"}
            </span>
          </div>
        </div>
      )}

      {/* Filtered Items Grid Section */}
      {selectedRating !== null && (
        <div className="mt-6 pt-6 border-t border-white/10 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-primary/20 text-primary font-bold text-xs border border-primary/30 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                {selectedRating} / 10
              </span>
              <span className="text-xs text-on-surface-variant font-medium">
                {filteredItems.length} {activeTab === "tv" ? "TV Show" : "Film"}{filteredItems.length === 1 ? "" : "s"} rated {selectedRating}★
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSelectedRating(null)}
              className="text-xs text-on-surface-variant hover:text-white flex items-center gap-1 transition-colors cursor-pointer bg-transparent border-none"
            >
              <span className="material-symbols-outlined text-xs">close</span>
              Clear filter
            </button>
          </div>

          {filteredItems.length === 0 ? (
            <p className="text-xs text-on-surface-variant opacity-60 py-4 text-center">
              No items found with this rating.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {filteredItems.map((item) => {
                const type = item.content_type === "tv" ? "tv" : "movie";
                const detailKey = `${type}_${item.movie_id}`;
                const detail = mediaDetails[detailKey] || mediaDetails[String(item.movie_id)];
                const title = detail?.title || detail?.name || "Loading...";
                const poster = detail?.poster_path;
                const year = (detail?.release_date || detail?.first_air_date || "").slice(0, 4);
                const linkHref = type === "tv" ? `/tv?id=${item.movie_id}` : `/movies?id=${item.movie_id}`;

                return (
                  <Link
                    key={`${type}_${item.movie_id}`}
                    href={linkHref}
                    className="group flex flex-col bg-white/5 hover:bg-white/10 rounded-xl overflow-hidden border border-white/5 hover:border-primary/30 transition-all hover:scale-[1.02] p-1.5"
                  >
                    <div className="aspect-[2/3] w-full rounded-lg overflow-hidden bg-black/40 relative">
                      {poster ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w342${poster}`}
                          alt={title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-white/5">
                          <span className="material-symbols-outlined text-on-surface-variant opacity-30 text-2xl mb-1">
                            movie
                          </span>
                          <span className="text-[10px] text-on-surface-variant opacity-60 line-clamp-2">
                            {title}
                          </span>
                        </div>
                      )}

                      {/* Rating overlay badge */}
                      <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-sm border border-white/15 text-[10px] font-bold text-secondary flex items-center gap-0.5 shadow">
                        <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                          star
                        </span>
                        {Number(item.rating).toFixed(1)}
                      </div>
                    </div>

                    <div className="pt-1.5 px-0.5">
                      <p className="text-xs text-on-surface font-semibold truncate group-hover:text-primary transition-colors">
                        {title}
                      </p>
                      {year && (
                        <p className="text-[10px] text-on-surface-variant opacity-50">
                          {year}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
