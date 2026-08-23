"use client";

import React, { useEffect } from "react";

export type TierLevel = 0 | 1 | 2 | 3 | 4;

export interface TierDefinition {
  tier: TierLevel;
  name: string; // "Bronze", "Silver", "Gold", "Platinum"
  threshold: number;
  description: string;
}

export interface BadgeCategoryData {
  id: "movie_buff" | "genre_explorer" | "critic";
  title: string;
  icon: string;
  unit: string;
  currentValue: number;
  tiers: TierDefinition[];
}

interface BadgeModalProps {
  badge: BadgeCategoryData | null;
  onClose: () => void;
}

export const TIER_COLORS: Record<TierLevel, {
  name: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  glow: string;
  progressGradient: string;
}> = {
  0: {
    name: "Locked",
    badgeBg: "bg-white/5",
    badgeBorder: "border-white/10",
    badgeText: "text-white/30",
    glow: "",
    progressGradient: "from-white/20 to-white/10",
  },
  1: {
    name: "Bronze",
    badgeBg: "bg-[#cd7f32]/20",
    badgeBorder: "border-[#cd7f32]/50",
    badgeText: "text-[#e09f58]",
    glow: "shadow-[0_0_12px_rgba(205,127,50,0.35)]",
    progressGradient: "from-[#cd7f32] to-[#e09f58]",
  },
  2: {
    name: "Silver",
    badgeBg: "bg-slate-300/20",
    badgeBorder: "border-slate-300/60",
    badgeText: "text-slate-100",
    glow: "shadow-[0_0_14px_rgba(226,232,240,0.4)]",
    progressGradient: "from-slate-400 to-slate-200",
  },
  3: {
    name: "Gold",
    badgeBg: "bg-[#ffd700]/20",
    badgeBorder: "border-[#ffd700]/70",
    badgeText: "text-[#ffd700]",
    glow: "shadow-[0_0_18px_rgba(255,215,0,0.5)]",
    progressGradient: "from-[#f59e0b] to-[#ffd700]",
  },
  4: {
    name: "Platinum",
    badgeBg: "bg-gradient-to-r from-cyan-500/25 via-purple-500/25 to-pink-500/25",
    badgeBorder: "border-cyan-400/80",
    badgeText: "text-cyan-200",
    glow: "shadow-[0_0_24px_rgba(168,85,247,0.6)] animate-pulse",
    progressGradient: "from-cyan-400 via-purple-400 to-pink-500",
  },
};

export default function BadgeModal({ badge, onClose }: BadgeModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!badge) return null;

  // Determine current tier based on currentValue
  let currentTierLevel: TierLevel = 0;
  for (const t of badge.tiers) {
    if (badge.currentValue >= t.threshold) {
      currentTierLevel = t.tier;
    }
  }

  // Find next tier target
  const nextTier = badge.tiers.find((t) => t.tier > currentTierLevel);
  const currentTierObj = badge.tiers.find((t) => t.tier === currentTierLevel);

  // Calculate progress percentage
  let progressPercent = 0;
  let progressText = "";

  if (!nextTier) {
    // Max tier reached
    progressPercent = 100;
    progressText = `${badge.currentValue} ${badge.unit} (Max Tier Achieved!)`;
  } else if (currentTierLevel === 0) {
    // Progress towards Tier 1
    progressPercent = Math.min(100, Math.round((badge.currentValue / nextTier.threshold) * 100));
    progressText = `${badge.currentValue} / ${nextTier.threshold} ${badge.unit}`;
  } else {
    // Progress towards next tier
    const prevThreshold = currentTierObj ? currentTierObj.threshold : 0;
    const totalNeeded = nextTier.threshold - prevThreshold;
    const currentGained = badge.currentValue - prevThreshold;
    progressPercent = Math.min(100, Math.max(0, Math.round((currentGained / totalNeeded) * 100)));
    progressText = `${badge.currentValue} / ${nextTier.threshold} ${badge.unit}`;
  }

  const currentTierStyle = TIER_COLORS[currentTierLevel];
  const nextTierStyle = nextTier ? TIER_COLORS[nextTier.tier] : currentTierStyle;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-md bg-[#121214] border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background Subtle Gradient */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-full p-1.5 transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>

        {/* Badge Header Display */}
        <div className="flex flex-col items-center text-center mt-2 mb-6">
          <div
            className={`w-20 h-20 rounded-full border-2 flex items-center justify-center mb-3 transition-all ${currentTierStyle.badgeBg} ${currentTierStyle.badgeBorder} ${currentTierStyle.glow}`}
          >
            <span className={`material-symbols-outlined text-4xl ${currentTierStyle.badgeText}`}>
              {currentTierLevel === 0 ? "lock" : badge.icon}
            </span>
          </div>

          <h3 className="text-xl font-bold text-white font-serif">{badge.title}</h3>
          
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`px-3 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${currentTierStyle.badgeBg} ${currentTierStyle.badgeBorder} ${currentTierStyle.badgeText}`}
            >
              {currentTierStyle.name} Tier
            </span>
          </div>
          
          <p className="text-xs text-white/60 mt-2 max-w-xs leading-relaxed">
            {currentTierLevel === 0
              ? `Watch movies or write reviews to unlock Tier 1 Bronze.`
              : currentTierObj?.description}
          </p>
        </div>

        {/* Progress Bar Section */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
          <div className="flex justify-between items-center text-xs mb-2">
            <span className="text-white/70 font-medium">
              {nextTier ? `Progress to ${nextTier.name}` : "Completion Status"}
            </span>
            <span className="font-bold text-white">{progressText}</span>
          </div>

          <div className="w-full h-3 bg-black/50 rounded-full overflow-hidden p-0.5 border border-white/10">
            <div
              className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${nextTierStyle.progressGradient}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {nextTier && (
            <p className="text-[11px] text-white/50 text-right mt-1.5">
              Need {nextTier.threshold - badge.currentValue} more {badge.unit} for {nextTier.name}
            </p>
          )}
        </div>

        {/* Tier Roadmap / Requirements */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-1">
            Achievement Tiers
          </h4>

          {badge.tiers.map((tierItem) => {
            const isUnlocked = badge.currentValue >= tierItem.threshold;
            const isCurrent = currentTierLevel === tierItem.tier;
            const tierStyle = TIER_COLORS[tierItem.tier];

            return (
              <div
                key={tierItem.tier}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  isCurrent
                    ? `${tierStyle.badgeBg} ${tierStyle.badgeBorder} shadow-sm`
                    : isUnlocked
                    ? "bg-white/[0.03] border-white/10 text-white/80"
                    : "bg-white/[0.01] border-white/5 text-white/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold ${
                      isUnlocked
                        ? `${tierStyle.badgeBg} ${tierStyle.badgeBorder} ${tierStyle.badgeText}`
                        : "bg-white/5 border-white/10 text-white/30"
                    }`}
                  >
                    {isUnlocked ? (
                      <span className="material-symbols-outlined text-sm">check</span>
                    ) : (
                      <span className="material-symbols-outlined text-sm">lock</span>
                    )}
                  </div>

                  <div>
                    <p className={`text-sm font-semibold ${isUnlocked ? "text-white" : "text-white/40"}`}>
                      {tierItem.name} Tier
                    </p>
                    <p className="text-xs opacity-60">
                      {tierItem.threshold} {badge.unit}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  {isCurrent ? (
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${tierStyle.badgeBg} ${tierStyle.badgeBorder} ${tierStyle.badgeText}`}
                    >
                      Current
                    </span>
                  ) : isUnlocked ? (
                    <span className="text-xs font-medium text-emerald-400">Unlocked ✓</span>
                  ) : (
                    <span className="text-xs font-medium opacity-40">Locked</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
