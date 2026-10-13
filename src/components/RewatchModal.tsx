"use client";

import React, { useState } from "react";
import { useToast } from "@/components/ToastProvider";

interface RewatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  contentId: string;
  contentType?: "movie" | "tv";
  title: string;
  posterPath?: string | null;
  defaultRating?: number | null;
  onSuccess?: (entry: any) => void;
}

export default function RewatchModal({
  isOpen,
  onClose,
  userId,
  contentId,
  contentType = "movie",
  title,
  posterPath,
  defaultRating = null,
  onSuccess,
}: RewatchModalProps) {
  const { showToast } = useToast();
  const [watchedDate, setWatchedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [rating, setRating] = useState<number | null>(defaultRating ?? null);
  const [hoverRating, setHoverRating] = useState<number>(defaultRating ?? 5);
  const [review, setReview] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !contentId) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/watch-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          content_id: String(contentId),
          content_type: contentType,
          title,
          poster_path: posterPath || null,
          watched_at: watchedDate ? new Date(watchedDate).toISOString() : new Date().toISOString(),
          rating: rating ?? null,
          review: review.trim() || null,
          is_rewatch: true,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save rewatch");
      }

      const data = await res.json();
      showToast(`Rewatch of "${title}" logged!`);
      if (onSuccess) onSuccess(data);
      onClose();
    } catch (err) {
      console.error("Error logging rewatch:", err);
      showToast("Failed to log rewatch");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#131313] border border-white/10 rounded-2xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2 text-purple-400">
            <span className="material-symbols-outlined text-xl">replay</span>
            <h3 className="font-serif text-lg font-bold text-on-surface">Log a Rewatch</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-on-surface-variant hover:text-white transition-all cursor-pointer border-none"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Item preview */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 mb-5">
          {posterPath ? (
            <img
              src={`https://image.tmdb.org/t/p/w92${posterPath}`}
              alt={title}
              className="w-12 h-18 object-cover rounded-md flex-shrink-0 bg-white/5"
            />
          ) : (
            <div className="w-12 h-18 rounded-md bg-white/10 flex items-center justify-center flex-shrink-0 text-white/30">
              <span className="material-symbols-outlined text-xl">movie</span>
            </div>
          )}
          <div className="min-w-0">
            <h4 className="font-bold text-sm text-on-surface truncate">{title}</h4>
            <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 inline-block mt-1">
              Rewatch Entry
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Watched Date */}
          <div>
            <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
              Rewatch Date
            </label>
            <input
              type="date"
              value={watchedDate}
              onChange={(e) => setWatchedDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-on-surface focus:outline-none focus:border-purple-400 [color-scheme:dark]"
              required
            />
          </div>

          {/* Optional Rating */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                Rating (Optional)
              </label>
              {rating !== null && (
                <button
                  type="button"
                  onClick={() => setRating(null)}
                  className="text-[10px] text-on-surface-variant/60 hover:text-white underline cursor-pointer bg-transparent border-none p-0"
                >
                  Clear Rating
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onClick={() => setRating(rating === star ? null : star)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                    rating === star
                      ? "bg-purple-600 text-white border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)] scale-105"
                      : (rating ?? 0) >= star
                      ? "bg-purple-500/30 text-purple-200 border-purple-500/40"
                      : hoverRating >= star
                      ? "bg-white/10 text-white border-white/20"
                      : "bg-white/5 text-on-surface-variant/40 border-white/5"
                  }`}
                >
                  {star}
                </button>
              ))}
            </div>
            {rating !== null && (
              <p className="text-[11px] text-purple-300 font-bold mt-1.5">★ {rating}/10</p>
            )}
          </div>

          {/* Optional Review */}
          <div>
            <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
              Rewatch Notes / Review (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="How did this viewing compare? What new details did you notice?"
              value={review}
              onChange={(e) => setReview(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-purple-400 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="w-1/2 py-2.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-on-surface-variant text-xs font-semibold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-1/2 py-2.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 border-none"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">replay</span>
                  Log Rewatch
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
