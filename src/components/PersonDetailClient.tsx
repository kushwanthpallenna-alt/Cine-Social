"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import NotificationBell from "@/components/NotificationBell";
import { getAvatarUrlOrDefault } from "@/lib/avatar";

interface PersonDetailClientProps {
  personId: string;
}

interface CreditItem {
  id: number;
  media_type: "movie" | "tv";
  title: string;
  release_date?: string;
  poster_path?: string | null;
  vote_average?: number;
  character?: string;
  job?: string;
  department?: string;
  episode_count?: number;
}

export default function PersonDetailClient({ personId }: PersonDetailClientProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user as any;

  const [person, setPerson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [watchedKeys, setWatchedKeys] = useState<Set<string>>(new Set());
  const [watchedLoading, setWatchedLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<"directing" | "acting" | "crew">("directing");
  const [mediaTypeFilter, setMediaTypeFilter] = useState<"all" | "movie" | "tv">("all");
  const [filterMode, setFilterMode] = useState<"all" | "watched" | "unwatched">("all");
  const [showFullBio, setShowFullBio] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  // 1. Fetch Person Details & Combined Credits from TMDB
  useEffect(() => {
    if (!personId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/tmdb?endpoint=person/${personId}&append_to_response=combined_credits,movie_credits,tv_credits`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load person details.");
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        setPerson(data);

        // Intelligently set default active tab based on known_for_department or available credits
        const dept = (data.known_for_department || "").toLowerCase();
        const crew = data.combined_credits?.crew || data.movie_credits?.crew || [];
        const cast = data.combined_credits?.cast || data.movie_credits?.cast || [];

        const hasDirecting = crew.some((c: any) => c.job === "Director");
        const hasActing = cast.length > 0;

        if (dept.includes("direct") && hasDirecting) {
          setActiveTab("directing");
        } else if (hasActing) {
          setActiveTab("acting");
        } else if (hasDirecting) {
          setActiveTab("directing");
        } else {
          setActiveTab("crew");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || "An unexpected error occurred.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [personId]);

  // 2. Fetch Logged-in User's Watched List from Supabase API
  useEffect(() => {
    if (!user?.id) return;

    setWatchedLoading(true);
    fetch(`/api/watched?userId=${user.id}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: any[]) => {
        if (Array.isArray(data)) {
          const keys = new Set<string>();
          data.forEach((w) => {
            const type = w.content_type || "movie";
            const id = String(w.movie_id);
            keys.add(`${type}_${id}`);
            keys.add(id); // fallback for raw id
          });
          setWatchedKeys(keys);
        }
      })
      .catch((err) => console.error("Error fetching watched list:", err))
      .finally(() => setWatchedLoading(false));
  }, [user?.id]);

  // Helper to check if credit item is watched
  const isItemWatched = (item: CreditItem) => {
    return (
      watchedKeys.has(`${item.media_type}_${item.id}`) ||
      (item.media_type === "movie" && watchedKeys.has(String(item.id))) ||
      watchedKeys.has(String(item.id))
    );
  };

  // Process & Deduplicate Credits
  const { directingCredits, actingCredits, otherCrewCredits } = useMemo(() => {
    const combined = person?.combined_credits;
    const movieCredits = person?.movie_credits;
    const tvCredits = person?.tv_credits;

    const rawCastList: any[] = [
      ...(combined?.cast || []),
      ...((!combined && movieCredits?.cast) ? movieCredits.cast.map((c: any) => ({ ...c, media_type: "movie" })) : []),
      ...((!combined && tvCredits?.cast) ? tvCredits.cast.map((c: any) => ({ ...c, media_type: "tv" })) : []),
    ];

    const rawCrewList: any[] = [
      ...(combined?.crew || []),
      ...((!combined && movieCredits?.crew) ? movieCredits.crew.map((c: any) => ({ ...c, media_type: "movie" })) : []),
      ...((!combined && tvCredits?.crew) ? tvCredits.crew.map((c: any) => ({ ...c, media_type: "tv" })) : []),
    ];

    // Deduplicate function by (media_type + id)
    const normalizeAndDedupe = (items: any[]): CreditItem[] => {
      const map = new Map<string, CreditItem>();
      for (const item of items) {
        if (!item.id) continue;
        const media_type: "movie" | "tv" = item.media_type === "tv" || (!item.title && item.name) ? "tv" : "movie";
        const key = `${media_type}_${item.id}`;
        if (!map.has(key)) {
          map.set(key, {
            id: item.id,
            media_type,
            title: item.title || item.name || "Untitled",
            release_date: item.release_date || item.first_air_date || "",
            poster_path: item.poster_path,
            vote_average: item.vote_average,
            character: item.character,
            job: item.job,
            department: item.department,
            episode_count: item.episode_count,
          });
        }
      }
      return Array.from(map.values()).sort((a, b) => {
        const dateA = a.release_date ? new Date(a.release_date).getTime() : 0;
        const dateB = b.release_date ? new Date(b.release_date).getTime() : 0;
        return dateB - dateA; // Newest first
      });
    };

    const directing = normalizeAndDedupe(rawCrewList.filter((c: any) => c.job === "Director"));
    const acting = normalizeAndDedupe(rawCastList);
    const otherCrew = normalizeAndDedupe(rawCrewList.filter((c: any) => c.job !== "Director"));

    return {
      directingCredits: directing,
      actingCredits: acting,
      otherCrewCredits: otherCrew,
    };
  }, [person]);

  // Current active list for selected Role Tab
  const currentRoleCredits = useMemo(() => {
    if (activeTab === "directing") return directingCredits;
    if (activeTab === "acting") return actingCredits;
    return otherCrewCredits;
  }, [activeTab, directingCredits, actingCredits, otherCrewCredits]);

  // Counts for media type sub-filter within the active role
  const roleMovieCount = useMemo(() => currentRoleCredits.filter((c) => c.media_type === "movie").length, [currentRoleCredits]);
  const roleTvCount = useMemo(() => currentRoleCredits.filter((c) => c.media_type === "tv").length, [currentRoleCredits]);

  // Filter by media type (All vs Movies vs TV Shows)
  const currentRoleFilteredByMedia = useMemo(() => {
    if (mediaTypeFilter === "movie") return currentRoleCredits.filter((c) => c.media_type === "movie");
    if (mediaTypeFilter === "tv") return currentRoleCredits.filter((c) => c.media_type === "tv");
    return currentRoleCredits;
  }, [currentRoleCredits, mediaTypeFilter]);

  // Calculate Watched Stats for the active list and media filter
  const activeStats = useMemo(() => {
    const total = currentRoleFilteredByMedia.length;
    const watchedCount = currentRoleFilteredByMedia.filter(isItemWatched).length;
    const percentage = total > 0 ? Math.round((watchedCount / total) * 100) : 0;

    return { total, watchedCount, percentage };
  }, [currentRoleFilteredByMedia, watchedKeys]);

  // Filtered credits to display (by Watched / Unwatched)
  const displayedCredits = useMemo(() => {
    return currentRoleFilteredByMedia.filter((item) => {
      const isW = isItemWatched(item);
      if (filterMode === "watched") return isW;
      if (filterMode === "unwatched") return !isW;
      return true;
    });
  }, [currentRoleFilteredByMedia, filterMode, watchedKeys]);

  if (loading) {
    return (
      <div className="bg-[#050505] text-[#e5e2e1] min-h-screen relative pb-32">
        {/* Header Skeleton */}
        <div className="fixed top-0 left-0 w-full z-50 bg-[#131313]/60 backdrop-blur-[40px] border-b border-white/10 flex justify-between items-center px-container-margin py-stack-md">
          <div className="h-6 w-20 bg-white/10 rounded-full animate-skeleton-pulse" />
          <div className="h-6 w-32 bg-white/10 rounded-full animate-skeleton-pulse" />
          <div className="h-8 w-8 bg-white/10 rounded-full animate-skeleton-pulse" />
        </div>
        {/* Hero Skeleton */}
        <div className="pt-28 px-container-margin max-w-screen-xl mx-auto flex flex-col md:flex-row gap-8">
          <div className="w-44 h-64 bg-white/10 rounded-2xl animate-skeleton-pulse flex-shrink-0 mx-auto md:mx-0" />
          <div className="flex-1 space-y-4 pt-4">
            <div className="h-10 bg-white/15 rounded-xl w-2/3 animate-skeleton-pulse" />
            <div className="h-5 bg-white/10 rounded-md w-1/3 animate-skeleton-pulse" />
            <div className="h-20 bg-white/10 rounded-xl w-full animate-skeleton-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="bg-[#050505] text-[#e5e2e1] min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <span className="material-symbols-outlined text-[64px] text-white/30 mb-4">error</span>
        <h2 className="text-2xl font-bold font-serif text-white mb-2">Person Not Found</h2>
        <p className="text-on-surface-variant max-w-md mb-6">{error || "Could not retrieve details for this person."}</p>
        <button
          onClick={handleBack}
          className="px-6 py-2.5 rounded-full bg-primary-container text-on-primary-container font-semibold flex items-center gap-2 hover:opacity-90 transition-all cursor-pointer border-none"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Go Back
        </button>
      </div>
    );
  }

  const bioText = person.biography || "";
  const isLongBio = bioText.length > 280;
  const displayBio = showFullBio || !isLongBio ? bioText : `${bioText.slice(0, 280)}...`;

  return (
    <div className="bg-[#050505] text-[#e5e2e1] font-body-md overflow-x-clip min-h-screen relative pb-32">
      {/* Top Header */}
      <header
        className={`fixed top-0 left-0 w-full z-50 flex justify-between items-center px-container-margin transition-all duration-300 ${
          scrolled
            ? "py-stack-sm bg-[#131313]/90 backdrop-blur-md border-b border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]"
            : "py-stack-md bg-gradient-to-b from-[#050505]/90 via-[#050505]/40 to-transparent border-none"
        }`}
      >
        <button
          onClick={handleBack}
          aria-label="Go back"
          className="flex items-center gap-stack-sm hover:opacity-80 transition-opacity cursor-pointer text-primary bg-transparent border-none drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)] p-0"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <Link href="/" className="hover:opacity-90 active:scale-98 transition-all block">
          <h1 className="font-display-md text-[24px] text-primary tracking-tighter uppercase select-none font-serif drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
            CINE SOCIAL
          </h1>
        </Link>
        <div className="flex items-center gap-stack-md">
          <NotificationBell />
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-8 h-8 rounded-full overflow-hidden border border-white/10 hover:opacity-80 transition-all focus:outline-none cursor-pointer flex items-center justify-center bg-white/5"
            >
              {user?.image ? (
                <img
                  alt={user?.name || "User"}
                  className="w-full h-full object-cover"
                  src={getAvatarUrlOrDefault(user.image)}
                />
              ) : (
                <span className="material-symbols-outlined text-on-surface-variant text-base">person</span>
              )}
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#131313]/90 border border-white/10 backdrop-blur-md p-2 shadow-[0_10px_30px_rgba(0,0,0,0.5)] z-50 animate-fade-in text-left">
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
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 md:pt-28 px-container-margin max-w-screen-xl mx-auto">
        {/* Person Hero Info Card */}
        <section className="glass-panel rounded-2xl p-6 md:p-8 mb-stack-xl flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start relative overflow-hidden">
          {/* Subtle Ambient Backdrop */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          {/* Profile Photo */}
          <div className="w-36 md:w-48 aspect-[2/3] rounded-xl overflow-hidden border border-white/15 shadow-2xl relative flex-shrink-0 bg-white/5">
            <img
              src={
                person.profile_path
                  ? `https://image.tmdb.org/t/p/w500${person.profile_path}`
                  : "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400"
              }
              alt={person.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Person Text Details */}
          <div className="flex-1 text-center md:text-left space-y-3 z-10">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span className="px-3 py-1 rounded-full bg-primary/20 text-primary font-bold text-xs uppercase tracking-widest border border-primary/30">
                {person.known_for_department || "Filmography"}
              </span>
              {person.place_of_birth && (
                <span className="text-xs text-on-surface-variant/80 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">location_on</span>
                  {person.place_of_birth}
                </span>
              )}
            </div>

            <h1 className="font-serif font-display-md text-3xl md:text-5xl text-white leading-tight">
              {person.name}
            </h1>

            {person.birthday && (
              <p className="text-xs text-on-surface-variant/70">
                Born: {new Date(person.birthday).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                {person.deathday && ` — Died: ${new Date(person.deathday).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
              </p>
            )}

            {bioText && (
              <div className="pt-2">
                <p className="text-body-md text-on-surface-variant/90 leading-relaxed max-w-3xl">
                  {displayBio}
                </p>
                {isLongBio && (
                  <button
                    onClick={() => setShowFullBio(!showFullBio)}
                    className="text-primary text-xs font-bold mt-1 hover:underline cursor-pointer bg-transparent border-none p-0 inline-flex items-center gap-0.5"
                  >
                    {showFullBio ? "Show Less" : "Read Full Bio"}
                    <span className="material-symbols-outlined text-xs">
                      {showFullBio ? "expand_less" : "expand_more"}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Watched Progress Stat Box */}
        <section className="glass-panel rounded-2xl p-6 md:p-8 mb-stack-xl relative overflow-hidden border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left flex-1">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <span className="material-symbols-outlined text-primary text-xl">auto_awesome</span>
                <span className="text-xs uppercase tracking-widest text-primary font-bold">Cinema Tracking</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-serif font-bold text-white">
                Filmography Progress
              </h2>
              <p className="text-on-surface-variant text-sm">
                {user?.id ? (
                  <>
                    You've watched <strong className="text-white font-bold">{activeStats.watchedCount}</strong> of{" "}
                    <strong className="text-white font-bold">{activeStats.total}</strong>{" "}
                    {mediaTypeFilter === "movie"
                      ? "movies"
                      : mediaTypeFilter === "tv"
                      ? "TV shows"
                      : "titles"}{" "}
                    in this view.
                  </>
                ) : (
                  "Sign in to track how many of this person's movies & TV shows you've watched!"
                )}
              </p>
            </div>

            {/* Percentage Readout */}
            <div className="flex items-center gap-4 bg-white/5 px-6 py-4 rounded-xl border border-white/10 flex-shrink-0">
              <div className="text-center">
                <span className="text-4xl md:text-5xl font-display-md font-bold text-primary block leading-none">
                  {activeStats.percentage}%
                </span>
                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Watched</span>
              </div>
              <div className="h-10 w-px bg-white/15" />
              <div className="text-left text-xs space-y-1">
                <p className="text-white font-bold">{activeStats.watchedCount} Seen</p>
                <p className="text-on-surface-variant/60">{activeStats.total - activeStats.watchedCount} Unwatched</p>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden mt-6 relative shadow-inner">
            <div
              className="bg-gradient-to-r from-primary to-secondary h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_12px_rgba(255,180,170,0.5)]"
              style={{ width: `${activeStats.percentage}%` }}
            />
          </div>
        </section>

        {/* Role Tabs */}
        <div className="mb-4 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {directingCredits.length > 0 && (
            <button
              onClick={() => {
                setActiveTab("directing");
                setMediaTypeFilter("all");
              }}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                activeTab === "directing"
                  ? "bg-primary text-black shadow-[0_0_15px_rgba(255,180,170,0.3)]"
                  : "bg-white/5 text-on-surface-variant hover:bg-white/10 border border-white/10"
              }`}
            >
              <span className="material-symbols-outlined text-sm">movie</span>
              Directing ({directingCredits.length})
            </button>
          )}

          {actingCredits.length > 0 && (
            <button
              onClick={() => {
                setActiveTab("acting");
                setMediaTypeFilter("all");
              }}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                activeTab === "acting"
                  ? "bg-primary text-black shadow-[0_0_15px_rgba(255,180,170,0.3)]"
                  : "bg-white/5 text-on-surface-variant hover:bg-white/10 border border-white/10"
              }`}
            >
              <span className="material-symbols-outlined text-sm">theater_comedy</span>
              Acting ({actingCredits.length})
            </button>
          )}

          {otherCrewCredits.length > 0 && (
            <button
              onClick={() => {
                setActiveTab("crew");
                setMediaTypeFilter("all");
              }}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                activeTab === "crew"
                  ? "bg-primary text-black shadow-[0_0_15px_rgba(255,180,170,0.3)]"
                  : "bg-white/5 text-on-surface-variant hover:bg-white/10 border border-white/10"
              }`}
            >
              <span className="material-symbols-outlined text-sm">video_settings</span>
              Other Crew ({otherCrewCredits.length})
            </button>
          )}
        </div>

        {/* Sub-Filters: Media Type Toggle (Movies vs TV) & Watched/Unwatched */}
        <section className="mb-stack-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-4">
          {/* Media Type Filter (All / Movies / TV Shows) */}
          <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setMediaTypeFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                mediaTypeFilter === "all"
                  ? "bg-white/20 text-white shadow-sm"
                  : "text-on-surface-variant/70 hover:text-white"
              }`}
            >
              All ({currentRoleCredits.length})
            </button>
            <button
              onClick={() => setMediaTypeFilter("movie")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                mediaTypeFilter === "movie"
                  ? "bg-primary/20 text-primary border border-primary/30 font-bold"
                  : "text-on-surface-variant/70 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-xs">local_movies</span>
              Movies ({roleMovieCount})
            </button>
            <button
              onClick={() => setMediaTypeFilter("tv")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                mediaTypeFilter === "tv"
                  ? "bg-purple-600/30 text-purple-300 border border-purple-500/40 font-bold"
                  : "text-on-surface-variant/70 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-xs">tv</span>
              TV Shows ({roleTvCount})
            </button>
          </div>

          {/* Watched / Unwatched Filter Pills */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-on-surface-variant/60 hidden md:inline">Filter:</span>
            <button
              onClick={() => setFilterMode("all")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                filterMode === "all" ? "bg-white/20 text-white" : "text-on-surface-variant/60 hover:text-white"
              }`}
            >
              All ({currentRoleFilteredByMedia.length})
            </button>
            <button
              onClick={() => setFilterMode("watched")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                filterMode === "watched" ? "bg-primary/20 text-primary font-bold" : "text-on-surface-variant/60 hover:text-white"
              }`}
            >
              Watched ({activeStats.watchedCount})
            </button>
            <button
              onClick={() => setFilterMode("unwatched")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                filterMode === "unwatched" ? "bg-white/20 text-white font-bold" : "text-on-surface-variant/60 hover:text-white"
              }`}
            >
              Unwatched ({activeStats.total - activeStats.watchedCount})
            </button>
          </div>
        </section>

        {/* Filmography Credits Grid */}
        {displayedCredits.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center text-on-surface-variant/60 space-y-3">
            <span className="material-symbols-outlined text-4xl">movie_off</span>
            <p className="text-sm font-semibold">No titles match the selected filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-stack-md">
            {displayedCredits.map((item) => {
              const isWatched = isItemWatched(item);
              const isTv = item.media_type === "tv";
              const year = item.release_date ? new Date(item.release_date).getFullYear() : "";
              const rating = item.vote_average ? item.vote_average.toFixed(1) : null;
              const roleLabel =
                activeTab === "directing"
                  ? "Director"
                  : item.character || item.job || "";
              const href = isTv ? `/tv?id=${item.id}` : `/movies?id=${item.id}`;

              return (
                <div key={`${item.media_type}_${item.id}`} className="group/card relative block animate-fade-in">
                  <Link href={href} className="cursor-pointer block">
                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden glass-panel mb-2 bg-white/5">
                      <img
                        alt={item.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                        src={
                          item.poster_path
                            ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
                            : "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500"
                        }
                        loading="lazy"
                      />

                      {/* Content Type Badge */}
                      <span
                        className={`absolute top-2 right-2 z-10 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded backdrop-blur-md shadow-md ${
                          isTv
                            ? "bg-purple-600/90 text-white border border-purple-400/30"
                            : "bg-black/60 text-white/80 border border-white/10"
                        }`}
                      >
                        {isTv ? "TV Show" : "Movie"}
                      </span>

                      {/* Watched Badge */}
                      {isWatched && (
                        <div className="absolute top-2 left-2 z-10 bg-black/80 backdrop-blur-md text-primary text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-primary/30 shadow-md">
                          <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            check_circle
                          </span>
                          Watched
                        </div>
                      )}

                      {/* Gradient overlay with rating */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity flex flex-col justify-end p-2">
                        {rating && (
                          <span className="text-secondary text-xs flex items-center gap-1 font-bold">
                            <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
                              star
                            </span>
                            {rating}
                          </span>
                        )}
                      </div>
                    </div>

                    <h4 className="text-body-md font-semibold group-hover/card:text-primary truncate transition-colors">
                      {item.title}
                    </h4>
                    <div className="flex justify-between items-center text-xs text-on-surface-variant/70 mt-0.5">
                      <span className="truncate max-w-[110px]">{roleLabel}</span>
                      {year && <span>{year}</span>}
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-[60px] z-50 mb-container-margin mx-container-margin rounded-full bg-surface/40 backdrop-blur-[100px] border border-white/10 shadow-[0_0_20px_rgba(255,180,170,0.1)] flex justify-around items-center w-full max-w-md md:left-1/2 md:-translate-x-1/2">
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/">
          <span className="material-symbols-outlined">home</span>
        </Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/recommendations">
          <span className="material-symbols-outlined">search</span>
        </Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/movies">
          <span className="material-symbols-outlined">bookmark</span>
        </Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/community">
          <span className="material-symbols-outlined">group</span>
        </Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/profile">
          <span className="material-symbols-outlined">person</span>
        </Link>
      </nav>
    </div>
  );
}
