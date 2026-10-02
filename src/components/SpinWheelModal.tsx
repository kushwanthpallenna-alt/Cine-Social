"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { getMovieUrl, getTvUrl } from "@/lib/slug";

type Scope = "movie" | "tv";
type Step = "filters" | "wheel" | "reveal";

const MOVIE_GENRES = [
  { id: 28, label: "Action", icon: "bolt" },
  { id: 878, label: "Sci-Fi", icon: "rocket" },
  { id: 18, label: "Drama", icon: "theater_comedy" },
  { id: 53, label: "Thriller", icon: "visibility" },
  { id: 35, label: "Comedy", icon: "sentiment_very_satisfied" },
  { id: 27, label: "Horror", icon: "skull" },
  { id: 10749, label: "Romance", icon: "favorite" },
  { id: 16, label: "Animation", icon: "palette" },
  { id: 80, label: "Crime", icon: "gavel" },
  { id: 12, label: "Adventure", icon: "explore" },
  { id: 9648, label: "Mystery", icon: "psychology" },
  { id: 14, label: "Fantasy", icon: "auto_fix_high" },
  { id: 99, label: "Documentary", icon: "video_camera_front" },
];

const TV_GENRES = [
  { id: 18, label: "Drama", icon: "theater_comedy" },
  { id: 35, label: "Comedy", icon: "sentiment_very_satisfied" },
  { id: 10765, label: "Sci-Fi & Fantasy", icon: "rocket" },
  { id: 80, label: "Crime", icon: "gavel" },
  { id: 10759, label: "Action & Adventure", icon: "bolt" },
  { id: 16, label: "Animation", icon: "palette" },
  { id: 9648, label: "Mystery", icon: "psychology" },
  { id: 10764, label: "Reality", icon: "videocam" },
  { id: 99, label: "Documentary", icon: "video_camera_front" },
];

const ERAS = [
  { label: "Any Era", gte: null, lte: null },
  { label: "2020s", gte: "2020-01-01", lte: null },
  { label: "2010s", gte: "2010-01-01", lte: "2019-12-31" },
  { label: "2000s", gte: "2000-01-01", lte: "2009-12-31" },
  { label: "1990s", gte: "1990-01-01", lte: "1999-12-31" },
  { label: "1980s", gte: "1980-01-01", lte: "1989-12-31" },
  { label: "1970s", gte: "1970-01-01", lte: "1979-12-31" },
  { label: "Classics (<1970)", gte: null, lte: "1969-12-31" },
];

const WEDGE_COLORS = [
  "#e50914", // Netflix Red
  "#00b4d8", // Cyan
  "#9b5de5", // Purple
  "#f77f00", // Orange
  "#06d6a0", // Emerald
  "#f72585", // Magenta
  "#ffd166", // Gold
  "#4361ee", // Blue
  "#7209b7", // Deep Violet
  "#2ec4b6", // Teal
  "#ef476f", // Coral
  "#3a86ff", // Azure
];

export interface CandidateTitle {
  id: number;
  title: string;
  poster_path?: string;
  backdrop_path?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  color: string;
}

interface SelectedPerson {
  id: number;
  name: string;
  profile_path?: string;
  known_for_department?: string;
}

interface SpinWheelModalProps {
  onClose: () => void;
}

// Draw SVG Wheel with real candidate titles as wedges
function CandidateWheelSVG({
  candidates,
  rotation,
}: {
  candidates: CandidateTitle[];
  rotation: number;
}) {
  const cx = 160;
  const cy = 160;
  const r = 150;
  const n = candidates.length;
  const sliceAngle = (2 * Math.PI) / n;

  return (
    <svg
      viewBox="0 0 320 320"
      className="w-full h-full drop-shadow-[0_0_45px_rgba(229,9,20,0.35)]"
      style={{ transform: `rotate(${rotation}deg)`, transition: "none" }}
    >
      {/* Outer neon ring */}
      <circle
        cx={cx}
        cy={cy}
        r={r + 4}
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="6"
      />
      <circle
        cx={cx}
        cy={cy}
        r={r + 1}
        fill="none"
        stroke="rgba(229,9,20,0.4)"
        strokeWidth="2"
      />

      {candidates.map((item, i) => {
        const startAngle = i * sliceAngle - Math.PI / 2;
        const endAngle = startAngle + sliceAngle;
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        const midAngle = startAngle + sliceAngle / 2;

        // Position text along the wedge radius
        const textR = r * 0.62;
        const tx = cx + textR * Math.cos(midAngle);
        const ty = cy + textR * Math.sin(midAngle);
        const textDeg = (midAngle * 180) / Math.PI + 90;

        const maxChars = n > 8 ? 14 : 18;
        const displayTitle =
          item.title.length > maxChars
            ? item.title.slice(0, maxChars - 1) + "…"
            : item.title;

        return (
          <g key={item.id}>
            <path
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`}
              fill={item.color}
              stroke="rgba(0,0,0,0.5)"
              strokeWidth="2"
              opacity="0.95"
            />
            {/* Inner border separator highlight */}
            <line
              x1={cx}
              y1={cy}
              x2={x1}
              y2={y1}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1"
            />
            {/* Title Text */}
            <text
              x={tx}
              y={ty}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={n > 8 ? "10" : "11"}
              fontWeight="800"
              fill="#ffffff"
              transform={`rotate(${textDeg}, ${tx}, ${ty})`}
              style={{
                textShadow: "0 2px 4px rgba(0,0,0,0.9)",
                letterSpacing: "-0.2px",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {displayTitle}
            </text>
          </g>
        );
      })}

      {/* Center hub styling */}
      <circle
        cx={cx}
        cy={cy}
        r={28}
        fill="#0a0a0c"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="3"
      />
      <circle cx={cx} cy={cy} r={18} fill="#e50914" />
      <circle cx={cx} cy={cy} r={6} fill="#ffffff" />
    </svg>
  );
}

export default function SpinWheelModal({ onClose }: SpinWheelModalProps) {
  const [scope, setScope] = useState<Scope>("movie");
  const [step, setStep] = useState<Step>("filters");

  // Filters State
  const [selectedGenreId, setSelectedGenreId] = useState<number | null>(null);
  const [selectedEra, setSelectedEra] = useState<string>("Any Era");
  const [selectedPerson, setSelectedPerson] = useState<SelectedPerson | null>(
    null
  );

  // Person Autocomplete State
  const [personQuery, setPersonQuery] = useState("");
  const [personResults, setPersonResults] = useState<SelectedPerson[]>([]);
  const [searchingPerson, setSearchingPerson] = useState(false);
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);

  // Candidates & Wheel State
  const [candidates, setCandidates] = useState<CandidateTitle[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candidateError, setCandidateError] = useState<string | null>(null);

  // Spin Physics State
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [displayRotation, setDisplayRotation] = useState(0);
  const [winner, setWinner] = useState<CandidateTitle | null>(null);

  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const startRotRef = useRef<number>(0);
  const targetRotRef = useRef<number>(0);
  const durationRef = useRef<number>(3800);

  const genres = scope === "movie" ? MOVIE_GENRES : TV_GENRES;

  // Lock scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Escape key listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Debounced Person Search
  useEffect(() => {
    if (!personQuery.trim() || selectedPerson) {
      setPersonResults([]);
      setSearchingPerson(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingPerson(true);
      try {
        const res = await fetch(
          `/api/tmdb?endpoint=search/person&query=${encodeURIComponent(
            personQuery.trim()
          )}`
        );
        if (res.ok) {
          const data = await res.json();
          const items: SelectedPerson[] = (data.results || []).slice(0, 5);
          setPersonResults(items);
          setShowPersonDropdown(true);
        }
      } catch (err) {
        console.error("Error searching person:", err);
      } finally {
        setSearchingPerson(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [personQuery, selectedPerson]);

  // Reset genre when scope changes if not valid
  const handleScopeChange = (newScope: Scope) => {
    setScope(newScope);
    setSelectedGenreId(null);
    setCandidateError(null);
  };

  // Fetch candidate titles from TMDB matching filters
  const handleGenerateCandidates = async () => {
    setLoadingCandidates(true);
    setCandidateError(null);

    try {
      const endpoint = scope === "movie" ? "discover/movie" : "discover/tv";
      const params = new URLSearchParams();

      // Genre
      if (selectedGenreId) {
        params.append("with_genres", String(selectedGenreId));
      }

      // Era
      const eraObj = ERAS.find((e) => e.label === selectedEra);
      if (eraObj) {
        if (scope === "movie") {
          if (eraObj.gte) params.append("primary_release_date.gte", eraObj.gte);
          if (eraObj.lte) params.append("primary_release_date.lte", eraObj.lte);
        } else {
          if (eraObj.gte) params.append("first_air_date.gte", eraObj.gte);
          if (eraObj.lte) params.append("first_air_date.lte", eraObj.lte);
        }
      }

      // Person (Actor / Director)
      if (selectedPerson) {
        params.append("with_people", String(selectedPerson.id));
      }

      // Sort and Quality
      params.append("sort_by", "popularity.desc");
      params.append("vote_count.gte", selectedPerson ? "5" : "30");

      // Randomize page between 1 and 3 for variety
      const randomPage = Math.floor(Math.random() * 2) + 1;
      params.append("page", String(randomPage));

      const res = await fetch(`/api/tmdb?endpoint=${endpoint}&${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch from TMDB");

      const data = await res.json();
      const results = data.results || [];

      // Filter out items without valid title or poster
      const validItems = results.filter(
        (item: any) =>
          (item.title || item.name) && (item.poster_path || item.backdrop_path)
      );

      if (validItems.length < 3) {
        setCandidateError(
          "Not enough titles found matching this combination. Try clearing the era or choosing a broader filter!"
        );
        return;
      }

      // Randomly pick 8 to 10 unique candidates
      const shuffled = [...validItems].sort(() => 0.5 - Math.random());
      const selectedPool = shuffled.slice(0, Math.min(shuffled.length, 10));

      const formattedCandidates: CandidateTitle[] = selectedPool.map(
        (item: any, idx: number) => ({
          id: item.id,
          title: item.title || item.name || "Untitled",
          poster_path: item.poster_path,
          backdrop_path: item.backdrop_path,
          overview: item.overview,
          release_date: item.release_date,
          first_air_date: item.first_air_date,
          vote_average: item.vote_average,
          color: WEDGE_COLORS[idx % WEDGE_COLORS.length],
        })
      );

      setCandidates(formattedCandidates);
      setStep("wheel");
      setRotation(0);
      setDisplayRotation(0);
      setWinner(null);
    } catch (err) {
      console.error("Candidate fetch error:", err);
      setCandidateError("Failed to load candidate titles. Please try again.");
    } finally {
      setLoadingCandidates(false);
    }
  };

  // Ease-out cubic deceleration for realistic wheel physics
  function easeOut(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  // Spin the Wheel among the real candidate titles
  const handleSpin = () => {
    if (spinning || candidates.length === 0) return;

    const n = candidates.length;
    const winIdx = Math.floor(Math.random() * n);
    const sliceDeg = 360 / n;

    // Center angle of winning wedge (from top = 0 deg)
    const segCenter = winIdx * sliceDeg + sliceDeg / 2;

    // Add 5-7 full spins plus the alignment offset so winIdx lands exactly at top (0 deg)
    const extraSpins = 5 + Math.floor(Math.random() * 3);
    const currentNorm = rotation % 360;
    const targetDelta =
      extraSpins * 360 + (360 - currentNorm) + (360 - segCenter);
    const newTarget = rotation + targetDelta;

    startRotRef.current = rotation;
    targetRotRef.current = newTarget;
    startTimeRef.current = performance.now();
    durationRef.current = 3400 + Math.random() * 600; // 3.4s - 4.0s

    setSpinning(true);
    setWinner(null);

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const t = Math.min(elapsed / durationRef.current, 1);
      const eased = easeOut(t);
      const currentRot =
        startRotRef.current +
        (targetRotRef.current - startRotRef.current) * eased;
      setDisplayRotation(currentRot);

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayRotation(newTarget);
        setRotation(newTarget);
        setSpinning(false);
        const winningItem = candidates[winIdx];
        setWinner(winningItem);
        // Small pause for dramatic tension before reveal
        setTimeout(() => {
          setStep("reveal");
        }, 700);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  };

  const handleSpinAgain = () => {
    setStep("wheel");
    setWinner(null);
  };

  const selectedGenreObj = genres.find((g) => g.id === selectedGenreId);
  const releaseYear = winner
    ? new Date(winner.release_date || winner.first_air_date || "").getFullYear()
    : null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#0e0e10] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              casino
            </span>
            <div>
              <h3 className="text-lg font-bold font-serif text-white leading-tight">
                Spin the Wheel
              </h3>
              <p className="text-[11px] text-white/50">
                Can't decide? Let the wheel choose your next watch!
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-full p-1.5 transition-colors cursor-pointer border-none"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* STEP 1: Filters & Candidate Generation */}
          {step === "filters" && (
            <div className="p-6 flex flex-col gap-5">
              {/* Scope (Movie vs TV) */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-white/60">
                  1. Choose Format
                </label>
                <div className="flex gap-3">
                  {(["movie", "tv"] as Scope[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleScopeChange(s)}
                      className={`flex-1 py-2.5 rounded-xl border text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        scope === s
                          ? "bg-primary text-black border-primary shadow-[0_0_20px_rgba(229,9,20,0.35)]"
                          : "bg-white/5 border-white/10 text-white/70 hover:border-white/25 hover:bg-white/10"
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">
                        {s === "movie" ? "movie" : "tv"}
                      </span>
                      {s === "movie" ? "Movies" : "TV Shows"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Genre Filter */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60">
                    2. Genre{" "}
                    <span className="text-white/40 lowercase font-normal">
                      (optional)
                    </span>
                  </label>
                  {selectedGenreId && (
                    <button
                      onClick={() => setSelectedGenreId(null)}
                      className="text-[11px] text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
                    >
                      Clear Genre
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1 no-scrollbar">
                  {genres.map((g) => {
                    const isSelected = selectedGenreId === g.id;
                    return (
                      <button
                        key={g.id}
                        onClick={() =>
                          setSelectedGenreId(isSelected ? null : g.id)
                        }
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                          isSelected
                            ? "bg-primary/20 border-primary text-primary shadow-[0_0_12px_rgba(229,9,20,0.3)] font-bold scale-105"
                            : "bg-white/5 border-white/10 text-white/70 hover:border-white/30 hover:text-white"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {g.icon}
                        </span>
                        {g.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Era / Decade Filter */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-white/60">
                  3. Era / Release Period{" "}
                  <span className="text-white/40 lowercase font-normal">
                    (optional)
                  </span>
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {ERAS.map((era) => {
                    const isSelected = selectedEra === era.label;
                    return (
                      <button
                        key={era.label}
                        onClick={() => setSelectedEra(era.label)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer border truncate text-center ${
                          isSelected
                            ? "bg-white/20 border-white/50 text-white font-bold shadow-sm"
                            : "bg-white/5 border-white/10 text-white/60 hover:border-white/25 hover:text-white"
                        }`}
                      >
                        {era.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Person / Creative Filter */}
              <div className="flex flex-col gap-2 relative">
                <label className="text-xs font-bold uppercase tracking-wider text-white/60">
                  4. Actor, Actress or Director{" "}
                  <span className="text-white/40 lowercase font-normal">
                    (optional)
                  </span>
                </label>
                {selectedPerson ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/10 border border-primary/40 animate-fade-in">
                    <div className="flex items-center gap-2.5">
                      {selectedPerson.profile_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w185${selectedPerson.profile_path}`}
                          alt={selectedPerson.name}
                          className="w-8 h-8 rounded-full object-cover border border-white/20"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                          {selectedPerson.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold text-white leading-tight">
                          {selectedPerson.name}
                        </p>
                        <p className="text-[10px] text-white/50">
                          {selectedPerson.known_for_department || "Creative"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedPerson(null);
                        setPersonQuery("");
                      }}
                      className="text-white/40 hover:text-white p-1 rounded-full bg-white/5 hover:bg-white/10 cursor-pointer border-none"
                    >
                      <span className="material-symbols-outlined text-sm">
                        close
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-base">
                      person_search
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. Christopher Nolan, Zendaya..."
                      value={personQuery}
                      onChange={(e) => setPersonQuery(e.target.value)}
                      onFocus={() => {
                        if (personResults.length > 0)
                          setShowPersonDropdown(true);
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-9 pr-8 text-xs text-white placeholder-white/40 focus:outline-none focus:border-primary/50"
                    />
                    {searchingPerson && (
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                    )}

                    {/* Person Dropdown */}
                    {showPersonDropdown && personResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#18181b] border border-white/15 rounded-xl shadow-2xl z-30 max-h-48 overflow-y-auto p-1 animate-fade-in">
                        {personResults.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setSelectedPerson(p);
                              setPersonQuery("");
                              setShowPersonDropdown(false);
                            }}
                            className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/10 transition-colors text-left cursor-pointer border-none bg-transparent"
                          >
                            {p.profile_path ? (
                              <img
                                src={`https://image.tmdb.org/t/p/w185${p.profile_path}`}
                                alt={p.name}
                                className="w-7 h-7 rounded-full object-cover border border-white/10 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-[10px] flex-shrink-0">
                                {p.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-white truncate">
                                {p.name}
                              </p>
                              <p className="text-[10px] text-white/50 truncate">
                                {p.known_for_department || "Creative"}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Error warning if not enough titles */}
              {candidateError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-xs flex items-start gap-2 animate-fade-in">
                  <span className="material-symbols-outlined text-sm text-red-400 mt-0.5">
                    warning
                  </span>
                  <div className="flex-1">
                    <p>{candidateError}</p>
                    <button
                      onClick={() => {
                        setSelectedEra("Any Era");
                        setSelectedPerson(null);
                        setCandidateError(null);
                      }}
                      className="text-[11px] font-bold text-primary underline mt-1 cursor-pointer bg-transparent border-none p-0 block"
                    >
                      Reset Era & Creative Filters
                    </button>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={handleGenerateCandidates}
                disabled={loadingCandidates}
                className="w-full py-3.5 bg-gradient-to-r from-primary to-secondary text-black font-bold rounded-full hover:opacity-90 active:scale-98 transition-all cursor-pointer text-sm shadow-[0_0_20px_rgba(229,9,20,0.3)] flex items-center justify-center gap-2 disabled:opacity-50 mt-1"
              >
                {loadingCandidates ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Finding Candidate Titles...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">
                      auto_awesome
                    </span>
                    Generate Wheel Titles! →
                  </>
                )}
              </button>
            </div>
          )}

          {/* STEP 2: The Wheel with Real Candidate Titles */}
          {step === "wheel" && (
            <div className="p-6 flex flex-col items-center gap-5">
              {/* Active Filter Chips */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px]">
                <span className="px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-bold">
                  {scope === "movie" ? "🎬 Movies" : "📺 TV Shows"}
                </span>
                {selectedGenreObj && (
                  <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white border border-white/15">
                    {selectedGenreObj.label}
                  </span>
                )}
                {selectedEra !== "Any Era" && (
                  <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white border border-white/15">
                    {selectedEra}
                  </span>
                )}
                {selectedPerson && (
                  <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white border border-white/15">
                    👤 {selectedPerson.name}
                  </span>
                )}
                <button
                  onClick={() => setStep("filters")}
                  className="text-white/40 hover:text-white underline cursor-pointer ml-1 bg-transparent border-none p-0"
                >
                  Edit Filters
                </button>
              </div>

              {/* The SVG Wheel */}
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex-shrink-0 my-1">
                {/* Pointer Arrow at Top (12 o'clock) */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2.5 z-20">
                  <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[22px] border-l-transparent border-r-transparent border-t-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]" />
                </div>

                <CandidateWheelSVG
                  candidates={candidates}
                  rotation={displayRotation}
                />
              </div>

              {/* Candidate Titles Legend */}
              <div className="w-full max-h-24 overflow-y-auto p-2 bg-white/5 rounded-xl border border-white/10 text-[11px] grid grid-cols-2 gap-1.5 no-scrollbar">
                {candidates.map((c) => (
                  <div key={c.id} className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="truncate text-white/80">{c.title}</span>
                  </div>
                ))}
              </div>

              {/* Spin Action Button */}
              <div className="flex gap-3 w-full">
                <button
                  onClick={handleSpin}
                  disabled={spinning}
                  className={`flex-1 py-3.5 px-6 rounded-full font-bold text-base transition-all cursor-pointer border-none shadow-xl flex items-center justify-center gap-2 ${
                    spinning
                      ? "bg-white/10 text-white/40 cursor-not-allowed"
                      : "bg-gradient-to-r from-primary via-red-500 to-secondary text-black hover:opacity-90 active:scale-95 shadow-primary/30"
                  }`}
                >
                  {spinning ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Spinning Wheel...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg">
                        casino
                      </span>
                      SPIN THE WHEEL!
                    </>
                  )}
                </button>
                <button
                  onClick={handleGenerateCandidates}
                  disabled={spinning || loadingCandidates}
                  title="Re-roll candidate titles"
                  className="px-4 rounded-full bg-white/10 hover:bg-white/15 text-white border border-white/15 transition-all cursor-pointer flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-base">
                    autorenew
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Reveal Result */}
          {step === "reveal" && winner && (
            <div className="p-6 flex flex-col items-center gap-5 animate-fade-in">
              <div className="text-center">
                <span className="text-[11px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                  🎉 The Wheel Has Chosen!
                </span>
              </div>

              {/* Winner Card */}
              <div className="w-full relative rounded-2xl overflow-hidden border border-white/15 shadow-2xl bg-surface-container">
                {winner.backdrop_path ? (
                  <div className="aspect-[16/9] w-full overflow-hidden relative">
                    <img
                      src={`https://image.tmdb.org/t/p/w780${winner.backdrop_path}`}
                      alt={winner.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                  </div>
                ) : (
                  <div className="aspect-[16/9] w-full bg-white/5 flex items-center justify-center">
                    <span className="material-symbols-outlined text-5xl text-white/20">
                      movie
                    </span>
                  </div>
                )}

                <div className="p-4 relative">
                  {/* Floating Poster */}
                  {winner.poster_path && (
                    <img
                      src={`https://image.tmdb.org/t/p/w185${winner.poster_path}`}
                      alt={winner.title}
                      className="w-16 sm:w-20 aspect-[2/3] rounded-lg border-2 border-white/20 shadow-xl object-cover absolute -top-10 right-4"
                    />
                  )}

                  <h4 className="text-xl font-bold font-serif text-white pr-20 line-clamp-1 drop-shadow-md">
                    {winner.title}
                  </h4>

                  <div className="flex items-center gap-3 mt-1 text-xs text-white/60">
                    {releaseYear && !isNaN(releaseYear) && (
                      <span className="font-mono">{releaseYear}</span>
                    )}
                    {winner.vote_average && winner.vote_average > 0 && (
                      <span className="flex items-center gap-1 text-secondary font-bold">
                        <span
                          className="material-symbols-outlined text-[14px]"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          star
                        </span>
                        {winner.vote_average.toFixed(1)}
                      </span>
                    )}
                    <span className="uppercase text-[10px] font-bold text-white/40 border border-white/10 px-1.5 py-0.5 rounded">
                      {scope === "movie" ? "Movie" : "TV Show"}
                    </span>
                  </div>

                  {winner.overview && (
                    <p className="text-xs text-white/70 leading-relaxed line-clamp-3 mt-3">
                      {winner.overview}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 w-full">
                <Link
                  href={
                    scope === "movie"
                      ? getMovieUrl(winner.id, winner.title)
                      : getTvUrl(winner.id, winner.title)
                  }
                  onClick={onClose}
                  className="flex-1 py-3 bg-primary text-black font-bold rounded-full text-center text-sm hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 no-underline shadow-lg"
                >
                  <span className="material-symbols-outlined text-base">
                    open_in_new
                  </span>
                  View Details
                </Link>
                <button
                  onClick={handleSpinAgain}
                  className="flex-1 py-3 bg-white/10 border border-white/15 text-white font-semibold rounded-full text-sm hover:bg-white/15 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">
                    refresh
                  </span>
                  Spin Again
                </button>
              </div>

              <button
                onClick={() => setStep("filters")}
                className="text-xs text-white/40 hover:text-white underline cursor-pointer bg-transparent border-none p-0"
              >
                Change Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
