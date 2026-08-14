"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import NotificationBell from "@/components/NotificationBell";
import { getAvatarUrlOrDefault } from "@/lib/avatar";

interface PersonDetailClientProps {
  personId: string;
}

export default function PersonDetailClient({ personId }: PersonDetailClientProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user as any;

  const [person, setPerson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [watchedMovieIds, setWatchedMovieIds] = useState<Set<string>>(new Set());
  const [watchedLoading, setWatchedLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<"directing" | "acting" | "crew">("directing");
  const [filterMode, setFilterMode] = useState<"all" | "watched" | "unwatched">("all");
  const [showFullBio, setShowFullBio] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // 1. Fetch Person Details & Credits from TMDB
  useEffect(() => {
    if (!personId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/tmdb?endpoint=person/${personId}&append_to_response=movie_credits`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load person details.");
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        setPerson(data);

        // Intelligently set default active tab based on known_for_department or available credits
        const dept = (data.known_for_department || "").toLowerCase();
        const crew = data.movie_credits?.crew || [];
        const cast = data.movie_credits?.cast || [];

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
          const ids = new Set<string>(data.map((w) => String(w.movie_id)));
          setWatchedMovieIds(ids);
        }
      })
      .catch((err) => console.error("Error fetching watched list:", err))
      .finally(() => setWatchedLoading(false));
  }, [user?.id]);

  // Process & Deduplicate Credits
  const { directingMovies, actingMovies, otherCrewMovies } = useMemo(() => {
    if (!person?.movie_credits) {
      return { directingMovies: [], actingMovies: [], otherCrewMovies: [] };
    }

    const castList: any[] = person.movie_credits.cast || [];
    const crewList: any[] = person.movie_credits.crew || [];

    // Deduplicate function by movie ID
    const dedupe = (items: any[]) => {
      const map = new Map<number, any>();
      for (const item of items) {
        if (!item.id) continue;
        if (!map.has(item.id)) {
          map.set(item.id, item);
        }
      }
      return Array.from(map.values()).sort((a, b) => {
        const dateA = a.release_date ? new Date(a.release_date).getTime() : 0;
        const dateB = b.release_date ? new Date(b.release_date).getTime() : 0;
        return dateB - dateA; // Newest first
      });
    };

    const directing = dedupe(crewList.filter((c: any) => c.job === "Director"));
    const acting = dedupe(castList);
    const otherCrew = dedupe(crewList.filter((c: any) => c.job !== "Director"));

    return {
      directingMovies: directing,
      actingMovies: acting,
      otherCrewMovies: otherCrew,
    };
  }, [person]);

  // Current active list based on tab selection
  const currentList = useMemo(() => {
    if (activeTab === "directing") return directingMovies;
    if (activeTab === "acting") return actingMovies;
    return otherCrewMovies;
  }, [activeTab, directingMovies, actingMovies, otherCrewMovies]);

  // Calculate Watched Stats for the active list
  const activeStats = useMemo(() => {
    const total = currentList.length;
    const watchedCount = currentList.filter((m) => watchedMovieIds.has(String(m.id))).length;
    const percentage = total > 0 ? Math.round((watchedCount / total) * 100) : 0;

    return { total, watchedCount, percentage };
  }, [currentList, watchedMovieIds]);

  // Overall Total Filmography Watched Stats (across all unique movies)
  const overallStats = useMemo(() => {
    const allUnique = new Map<number, any>();
    [...directingMovies, ...actingMovies, ...otherCrewMovies].forEach((m) => {
      if (m.id && !allUnique.has(m.id)) allUnique.set(m.id, m);
    });
    const total = allUnique.size;
    let watchedCount = 0;
    allUnique.forEach((m) => {
      if (watchedMovieIds.has(String(m.id))) watchedCount++;
    });
    const percentage = total > 0 ? Math.round((watchedCount / total) * 100) : 0;
    return { total, watchedCount, percentage };
  }, [directingMovies, actingMovies, otherCrewMovies, watchedMovieIds]);

  // Filtered movies to display
  const displayedMovies = useMemo(() => {
    return currentList.filter((m) => {
      const isW = watchedMovieIds.has(String(m.id));
      if (filterMode === "watched") return isW;
      if (filterMode === "unwatched") return !isW;
      return true;
    });
  }, [currentList, filterMode, watchedMovieIds]);

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
          onClick={() => router.back()}
          className="px-6 py-2.5 rounded-full bg-primary-container text-on-primary-container font-semibold flex items-center gap-2 hover:opacity-90 transition-all cursor-pointer"
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
      <header className="fixed top-0 left-0 w-full z-50 bg-[#131313]/60 backdrop-blur-[40px] border-b border-white/10 flex justify-between items-center px-container-margin py-stack-md shadow-[0_8px_32px_0_rgba(255,180,170,0.05)]">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-stack-sm hover:opacity-80 transition-opacity cursor-pointer text-primary bg-transparent border-none"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <Link href="/" className="hover:opacity-90 active:scale-98 transition-all block">
          <h1 className="font-display-md text-[24px] text-primary tracking-tighter uppercase select-none font-serif">
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
              <img
                alt={user?.name || "User"}
                className="w-full h-full object-cover"
                src={getAvatarUrlOrDefault(user?.image)}
              />
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
                    <strong className="text-white font-bold">{activeStats.total}</strong> movies in this section.
                  </>
                ) : (
                  "Sign in to track how many of this person's movies you've watched!"
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

        {/* Tab & Filter Controls */}
        <section className="mb-stack-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-4">
          {/* Role Tabs (Directing / Acting / Other Crew) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:w-auto">
            {directingMovies.length > 0 && (
              <button
                onClick={() => setActiveTab("directing")}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                  activeTab === "directing"
                    ? "bg-primary text-black shadow-[0_0_15px_rgba(255,180,170,0.3)]"
                    : "bg-white/5 text-on-surface-variant hover:bg-white/10 border border-white/10"
                }`}
              >
                <span className="material-symbols-outlined text-sm">movie</span>
                Directing ({directingMovies.length})
              </button>
            )}

            {actingMovies.length > 0 && (
              <button
                onClick={() => setActiveTab("acting")}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                  activeTab === "acting"
                    ? "bg-primary text-black shadow-[0_0_15px_rgba(255,180,170,0.3)]"
                    : "bg-white/5 text-on-surface-variant hover:bg-white/10 border border-white/10"
                }`}
              >
                <span className="material-symbols-outlined text-sm">theater_comedy</span>
                Acting ({actingMovies.length})
              </button>
            )}

            {otherCrewMovies.length > 0 && (
              <button
                onClick={() => setActiveTab("crew")}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                  activeTab === "crew"
                    ? "bg-primary text-black shadow-[0_0_15px_rgba(255,180,170,0.3)]"
                    : "bg-white/5 text-on-surface-variant hover:bg-white/10 border border-white/10"
                }`}
              >
                <span className="material-symbols-outlined text-sm">video_settings</span>
                Other Crew ({otherCrewMovies.length})
              </button>
            )}
          </div>

          {/* Watched Filter Pills */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-on-surface-variant/60 hidden md:inline">Filter:</span>
            <button
              onClick={() => setFilterMode("all")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                filterMode === "all" ? "bg-white/20 text-white" : "text-on-surface-variant/60 hover:text-white"
              }`}
            >
              All ({currentList.length})
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

        {/* Filmography Movie Grid */}
        {displayedMovies.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center text-on-surface-variant/60 space-y-3">
            <span className="material-symbols-outlined text-4xl">movie_off</span>
            <p className="text-sm font-semibold">No movies match the selected filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-stack-md">
            {displayedMovies.map((movie: any) => {
              const isWatched = watchedMovieIds.has(String(movie.id));
              const year = movie.release_date ? new Date(movie.release_date).getFullYear() : "";
              const rating = movie.vote_average ? movie.vote_average.toFixed(1) : null;
              const roleLabel = activeTab === "directing" ? "Director" : movie.character || movie.job || "";

              return (
                <div key={movie.id} className="group/card relative block animate-fade-in">
                  <Link href={`/movies?id=${movie.id}`} className="cursor-pointer block">
                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden glass-panel mb-2 bg-white/5">
                      <img
                        alt={movie.title || movie.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                        src={
                          movie.poster_path
                            ? `https://image.tmdb.org/t/p/w342${movie.poster_path}`
                            : "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500"
                        }
                        loading="lazy"
                      />
                      {/* Gradient overlay */}
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

                      {/* Watched Badge */}
                      {isWatched && (
                        <div className="absolute top-2 left-2 z-10 bg-black/80 backdrop-blur-md text-primary text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-primary/30 shadow-md">
                          <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            check_circle
                          </span>
                          Watched
                        </div>
                      )}
                    </div>

                    <h4 className="text-body-md font-semibold group-hover/card:text-primary truncate transition-colors">
                      {movie.title || movie.name}
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
