"use client";

import React, { useState } from "react";
import BadgeModal, {
  BadgeCategoryData,
  TierLevel,
  TIER_COLORS,
} from "./BadgeModal";

interface ProfileBadgesProps {
  watchedCount: number;
  distinctGenresCount: number;
  reviewCount: number;
  className?: string;
}

export function calculateBadgeTier(
  value: number,
  thresholds: [number, number, number, number]
): TierLevel {
  if (value >= thresholds[3]) return 4;
  if (value >= thresholds[2]) return 3;
  if (value >= thresholds[1]) return 2;
  if (value >= thresholds[0]) return 1;
  return 0;
}

export default function ProfileBadges({
  watchedCount = 0,
  distinctGenresCount = 0,
  reviewCount = 0,
  className = "",
}: ProfileBadgesProps) {
  const [selectedBadge, setSelectedBadge] = useState<BadgeCategoryData | null>(null);

  const categories: BadgeCategoryData[] = [
    {
      id: "movie_buff",
      title: "Movie Buff",
      icon: "movie",
      unit: "movies watched",
      currentValue: watchedCount,
      tiers: [
        { tier: 1, name: "Bronze", threshold: 50, description: "Watched 50+ movies" },
        { tier: 2, name: "Silver", threshold: 100, description: "Watched 100+ movies" },
        { tier: 3, name: "Gold", threshold: 200, description: "Watched 200+ movies" },
        { tier: 4, name: "Platinum", threshold: 500, description: "Watched 500+ movies" },
      ],
    },
    {
      id: "genre_explorer",
      title: "Genre Explorer",
      icon: "explore",
      unit: "distinct genres watched",
      currentValue: distinctGenresCount,
      tiers: [
        { tier: 1, name: "Bronze", threshold: 5, description: "Watched movies across 5 distinct genres" },
        { tier: 2, name: "Silver", threshold: 8, description: "Watched movies across 8 distinct genres" },
        { tier: 3, name: "Gold", threshold: 12, description: "Watched movies across 12 distinct genres" },
        { tier: 4, name: "Platinum", threshold: 19, description: "Watched movies across all 19 major genres" },
      ],
    },
    {
      id: "critic",
      title: "Critic",
      icon: "rate_review",
      unit: "reviews written",
      currentValue: reviewCount,
      tiers: [
        { tier: 1, name: "Bronze", threshold: 5, description: "Written 5+ film reviews" },
        { tier: 2, name: "Silver", threshold: 15, description: "Written 15+ film reviews" },
        { tier: 3, name: "Gold", threshold: 30, description: "Written 30+ film reviews" },
        { tier: 4, name: "Platinum", threshold: 50, description: "Written 50+ film reviews" },
      ],
    },
  ];

  return (
    <>
      <div className={`flex items-center gap-2.5 ${className}`}>
        {categories.map((cat) => {
          let currentTier: TierLevel = 0;
          for (const t of cat.tiers) {
            if (cat.currentValue >= t.threshold) {
              currentTier = t.tier;
            }
          }

          const style = TIER_COLORS[currentTier];

          return (
            <button
              key={cat.id}
              onClick={() => setSelectedBadge(cat)}
              className={`group relative p-2 rounded-full border flex items-center justify-center transition-all duration-300 cursor-pointer hover:scale-110 active:scale-95 focus:outline-none ${style.badgeBg} ${style.badgeBorder} ${style.glow}`}
              title={`${cat.title} (${style.name} Tier)`}
              aria-label={`View ${cat.title} badge details (${style.name} Tier)`}
            >
              <span className={`material-symbols-outlined text-base md:text-lg ${style.badgeText}`}>
                {currentTier === 0 ? "lock" : cat.icon}
              </span>

              {/* Small indicator pill on hover/touch preview */}
              <span className="sr-only">
                {cat.title} - {style.name} Tier
              </span>
            </button>
          );
        })}
      </div>

      {/* Detail Modal */}
      <BadgeModal
        badge={selectedBadge}
        onClose={() => setSelectedBadge(null)}
      />
    </>
  );
}
