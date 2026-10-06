"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const ALL_MOODS = [
  "Melancholic",
  "Adrenaline Rush",
  "Mind-Bending",
  "Cyberpunk Noir",
  "Existential",
  "Feel-Good",
  "Romantic",
  "Darkly Comic",
  "Suspenseful",
  "Epic & Grand",
];

const GENRE_LABELS: Record<string, string> = {
  "Sci-Fi": "878",
  Drama: "18",
  Action: "28",
  Thriller: "53",
  Comedy: "35",
  Horror: "27",
  Romance: "10749",
  Animation: "16",
  Documentary: "99",
  Crime: "80",
};

interface EditFilterModalProps {
  userId: string;
  activeMoods: string[];
  customMood: string;
  genreWeights: Record<string, number>;
  onSave: (moods: string[], customMood: string, weights: Record<string, number>) => void;
  onClose: () => void;
}

export default function EditFilterModal({
  userId,
  activeMoods,
  customMood: initialCustomMood,
  genreWeights: initialWeights,
  onSave,
  onClose,
}: EditFilterModalProps) {
  const [selectedMoods, setSelectedMoods] = useState<string[]>(activeMoods);
  const [customMood, setCustomMood] = useState(initialCustomMood);
  const [weights, setWeights] = useState<Record<string, number>>(
    initialWeights && Object.keys(initialWeights).length > 0
      ? initialWeights
      : Object.fromEntries(Object.keys(GENRE_LABELS).map((g) => [g, 0]))
  );
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"moods" | "dna">("moods");

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const toggleMood = (mood: string) => {
    setSelectedMoods((prev) =>
      prev.includes(mood) ? prev.filter((m) => m !== mood) : [...prev, mood]
    );
  };

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  const handleSave = async () => {
    if (selectedMoods.length === 0) return;
    setSaving(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(
          "cinema_dna_prefs",
          JSON.stringify({
            moods: selectedMoods,
            custom_mood: customMood.trim(),
            genre_weights: weights,
          })
        );
      }
      if (userId) {
        await supabase.from("user_mood_preferences").upsert(
          {
            user_id: userId,
            moods: selectedMoods,
            custom_mood: customMood.trim() || null,
            genre_weights: weights,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      }
      onSave(selectedMoods, customMood.trim(), weights);
      onClose();
    } catch (err) {
      console.error("Error saving mood preferences:", err);
      onSave(selectedMoods, customMood.trim(), weights);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-[#0e0e10] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/10 flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold font-serif text-white">Edit Cinema Filter</h3>
            <p className="text-xs text-white/50 mt-0.5">Personalise your recommendation context</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-full p-1.5 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 flex-shrink-0">
          {(["moods", "dna"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer border-none ${
                activeTab === tab
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {tab === "moods" ? "🎭 Mood Pills" : "🧬 Cinema DNA"}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "moods" ? (
            <>
              {/* Mood selector */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">
                  Select which mood pills appear
                </p>
                <div className="flex flex-wrap gap-2">
                  {ALL_MOODS.map((mood) => {
                    const active = selectedMoods.includes(mood);
                    return (
                      <button
                        key={mood}
                        onClick={() => toggleMood(mood)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
                          active
                            ? "bg-primary/20 text-primary border-primary/50 shadow-[0_0_10px_rgba(229,9,20,0.2)]"
                            : "bg-white/5 text-white/50 border-white/10 hover:border-white/30"
                        }`}
                      >
                        {active && <span className="mr-1">✓</span>}
                        {mood}
                      </button>
                    );
                  })}
                </div>
                {selectedMoods.length === 0 && (
                  <p className="text-xs text-red-400 mt-2">Select at least one mood.</p>
                )}
              </div>

              {/* Custom mood */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">
                  Add a custom mood tag
                </p>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-base">
                    edit
                  </span>
                  <input
                    type="text"
                    value={customMood}
                    onChange={(e) => setCustomMood(e.target.value)}
                    placeholder="e.g. Wes Anderson vibes, late night noir..."
                    maxLength={60}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-sm text-on-surface placeholder-white/30 focus:outline-none focus:border-primary/50 transition-all"
                  />
                </div>
                <p className="text-[11px] text-white/30 mt-1.5">
                  This is injected into the AI prompt when generating recommendations.
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Genre weights */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-white/40">
                    Genre weight sliders
                  </p>
                  <span className="text-[11px] text-white/30">Total: {totalWeight}%</span>
                </div>
                <div className="space-y-4">
                  {Object.keys(GENRE_LABELS).map((genre) => {
                    const val = weights[genre] ?? 0;
                    const pct = totalWeight > 0 ? Math.round((val / totalWeight) * 100) : 0;
                    return (
                      <div key={genre}>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-sm font-semibold text-white/80">{genre}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-white/40">{pct}%</span>
                            <span className="text-xs font-bold text-primary w-6 text-right">{val}</span>
                          </div>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={50}
                          step={1}
                          value={val}
                          onChange={(e) =>
                            setWeights((prev) => ({ ...prev, [genre]: parseInt(e.target.value) }))
                          }
                          className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-primary"
                          style={{
                            background: `linear-gradient(to right, rgb(229,9,20) 0%, rgb(229,9,20) ${(val / 50) * 100}%, rgba(255,255,255,0.1) ${(val / 50) * 100}%, rgba(255,255,255,0.1) 100%)`,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-white/30 mt-4">
                  Higher values nudge recommendations toward that genre. These weights are included in your AI prompt context.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-full border border-white/15 text-white/60 text-sm font-semibold hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || selectedMoods.length === 0}
            className="flex-1 py-2.5 rounded-full bg-primary text-black text-sm font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-sm">save</span>
            )}
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
