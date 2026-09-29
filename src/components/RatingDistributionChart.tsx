"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { getPosterUrl } from "@/lib/poster";

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
  posterPrefs?: Record<string, string>;
  className?: string;
}

type DistributionSortOption =
  | "date_desc"
  | "date_asc"
  | "runtime_desc"
  | "runtime_asc"
  | "tmdb_desc"
  | "tmdb_asc";

const SORT_BUTTONS: { id: DistributionSortOption; label: string; icon: string }[] = [
  { id: "date_desc", label: "Release (Newest)", icon: "calendar_today" },
  { id: "date_asc", label: "Release (Oldest)", icon: "history" },
  { id: "runtime_desc", label: "Runtime (Longest)", icon: "schedule" },
  { id: "runtime_asc", label: "Runtime (Shortest)", icon: "timer" },
  { id: "tmdb_desc", label: "TMDB Rating (Highest)", icon: "grade" },
  { id: "tmdb_asc", label: "TMDB Rating (Lowest)", icon: "star_half" },
];

const RATING_STEPS = [
  0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0,
  5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0,
];

export default function RatingDistributionChart({
  ratings = [],
  mediaDetails = {},
  posterPrefs = {},
  className = "",
}: RatingDistributionChartProps) {
  const [activeTab, setActiveTab] = useState<"movie" | "tv">("movie");
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<DistributionSortOption>("date_desc");

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

  // Filtered and sorted items when a bar is clicked
  const filteredAndSortedItems = useMemo(() => {
    if (selectedRating === null) return [];
    
    const items = currentRatings.filter((item) => {
      const val = Number(item.rating);
      const snapped = Math.round(val * 2) / 2;
      return snapped === selectedRating;
    });

    return [...items].sort((a, b) => {
      const typeA = a.content_type === "tv" ? "tv" : "movie";
      const typeB = b.content_type === "tv" ? "tv" : "movie";
      const detailA = mediaDetails[`${typeA}_${a.movie_id}`] || mediaDetails[String(a.movie_id)];
      const detailB = mediaDetails[`${typeB}_${b.movie_id}`] || mediaDetails[String(b.movie_id)];

      if (sortBy === "date_desc" || sortBy === "date_asc") {
        const dateA = new Date(detailA?.release_date || detailA?.first_air_date || 0).getTime();
        const dateB = new Date(detailB?.release_date || detailB?.first_air_date || 0).getTime();
        return sortBy === "date_desc" ? dateB - dateA : dateA - dateB;
      }

      if (sortBy === "runtime_desc" || sortBy === "runtime_asc") {
        const runtimeA = Number(detailA?.runtime || (detailA?.episode_run_time && detailA.episode_run_time[0]) || 0);
        const runtimeB = Number(detailB?.runtime || (detailB?.episode_run_time && detailB.episode_run_time[0]) || 0);
        return sortBy === "runtime_desc" ? runtimeB - runtimeA : runtimeA - runtimeB;
      }

      if (sortBy === "tmdb_desc" || sortBy === "tmdb_asc") {
        const voteA = Number(detailA?.vote_average || 0);
        const voteB = Number(detailB?.vote_average || 0);
        return sortBy === "tmdb_desc" ? voteB - voteA : voteA - voteB;
      }

      return 0;
    });
  }, [currentRatings, selectedRating, sortBy, mediaDetails]);

  const handleBarClick = (step: number) => {
    if (selectedRating === step) {
      setSelectedRating(null);
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

                    {/* Subtle tick for whole numbers */}
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-primary/20 text-primary font-bold text-xs border border-primary/30 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                {selectedRating} / 10
              </span>
              <span className="text-xs text-on-surface-variant font-medium">
                {filteredAndSortedItems.length} {activeTab === "tv" ? "TV Show" : "Film"}{filteredAndSortedItems.length === 1 ? "" : "s"} rated {selectedRating}★
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSelectedRating(null)}
              className="text-xs text-on-surface-variant hover:text-white flex items-center gap-1 transition-colors cursor-pointer bg-transparent border-none self-start md:self-auto"
            >
              <span className="material-symbols-outlined text-xs">close</span>
              Clear filter
            </button>
          </div>

          {/* Sort Controls (Pill buttons) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 hide-scrollbar">
            <span className="text-[11px] text-on-surface-variant/60 uppercase tracking-wider font-semibold mr-1 flex-shrink-0">
              Sort by:
            </span>
            {SORT_BUTTONS.map((btn) => {
              const isActive = sortBy === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setSortBy(btn.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer flex-shrink-0 border select-none ${
                    isActive
                      ? "bg-primary text-black border-primary shadow-sm font-semibold"
                      : "bg-white/5 text-on-surface-variant border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20"
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">{btn.icon}</span>
                  {btn.label}
                </button>
              );
            })}
          </div>

          {filteredAndSortedItems.length === 0 ? (
            <p className="text-xs text-on-surface-variant opacity-60 py-4 text-center">
              No items found with this rating.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {filteredAndSortedItems.map((item) => {
                const type = item.content_type === "tv" ? "tv" : "movie";
                const detailKey = `${type}_${item.movie_id}`;
                const detail = mediaDetails[detailKey] || mediaDetails[String(item.movie_id)];
                const title = detail?.title || detail?.name || "Loading...";
                const posterUrl = getPosterUrl({
                  movieId: item.movie_id,
                  contentType: type,
                  defaultPosterPath: detail?.poster_path,
                  posterPrefs,
                  size: "w342",
                });
                const year = (detail?.release_date || detail?.first_air_date || "").slice(0, 4);
                const runtime = detail?.runtime || (detail?.episode_run_time && detail.episode_run_time[0]);
                const tmdbRating = detail?.vote_average ? Number(detail.vote_average).toFixed(1) : null;
                const linkHref = type === "tv" ? `/tv?id=${item.movie_id}` : `/movies?id=${item.movie_id}`;

                return (
                  <Link
                    key={`${type}_${item.movie_id}`}
                    href={linkHref}
                    className="group flex flex-col bg-white/5 hover:bg-white/10 rounded-xl overflow-hidden border border-white/5 hover:border-primary/30 transition-all hover:scale-[1.02] p-1.5"
                  >
                    <div className="aspect-[2/3] w-full rounded-lg overflow-hidden bg-black/40 relative">
                      <img
                        src={posterUrl}
                        alt={title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />

                      {/* User rating overlay badge */}
                      <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-sm border border-white/15 text-[10px] font-bold text-secondary flex items-center gap-0.5 shadow">
                        <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                          star
                        </span>
                        {Number(item.rating).toFixed(1)}
                      </div>

                      {/* TMDB score badge on bottom left if available */}
                      {tmdbRating && (
                        <div className="absolute bottom-1 left-1 px-1 py-0.5 rounded bg-black/70 backdrop-blur-xs text-[9px] font-mono text-white/80 flex items-center gap-0.5">
                          <span className="text-primary font-bold">TMDB</span> {tmdbRating}
                        </div>
                      )}
                    </div>

                    <div className="pt-1.5 px-0.5">
                      <p className="text-xs text-on-surface font-semibold truncate group-hover:text-primary transition-colors">
                        {title}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-on-surface-variant opacity-60 mt-0.5">
                        {year && <span>{year}</span>}
                        {runtime ? <span>{runtime}m</span> : null}
                      </div>
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

