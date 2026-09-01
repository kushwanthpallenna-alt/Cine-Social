"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { supabase } from "@/lib/supabase";
import NotificationBell from "@/components/NotificationBell";
import ReviewCard from "@/components/ReviewCard";
import Carousel from "@/components/Carousel";
import { getAvatarUrlOrDefault } from "@/lib/avatar";

const CONTENT_TYPE = "tv";

// ─── Skeleton ────────────────────────────────────────────────────────────────
const DetailsSkeleton = () => (
  <div className="bg-[#050505] text-[#e5e2e1] min-h-screen relative pb-32">
    <div className="fixed top-0 left-0 w-full z-50 bg-[#131313]/60 backdrop-blur-[40px] border-b border-white/10 flex justify-between items-center px-6 py-4">
      <div className="h-6 w-24 bg-white/10 rounded-full animate-skeleton-pulse"></div>
      <div className="h-6 w-32 bg-white/10 rounded-full animate-skeleton-pulse"></div>
      <div className="h-8 w-8 bg-white/10 rounded-full animate-skeleton-pulse"></div>
    </div>
    <div className="h-[450px] md:h-[550px] w-full bg-gradient-to-b from-purple-900/20 via-white/5 to-[#050505] relative animate-skeleton-pulse">
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent"></div>
    </div>
    <div className="px-6 -mt-36 md:-mt-44 relative z-10 max-w-screen-xl mx-auto w-full">
      <div className="flex flex-col md:flex-row gap-6 md:gap-10">
        <div className="w-40 md:w-64 aspect-[2/3] rounded-2xl bg-white/10 border border-white/10 shadow-2xl flex-shrink-0 animate-skeleton-pulse mx-auto md:mx-0"></div>
        <div className="flex-grow pt-4 md:pt-16 space-y-4">
          <div className="h-4 bg-white/10 rounded w-1/3 animate-skeleton-pulse"></div>
          <div className="h-10 md:h-14 bg-white/15 rounded-xl w-3/4 animate-skeleton-pulse"></div>
          <div className="flex gap-4">
            <div className="h-8 bg-white/10 rounded-full w-24 animate-skeleton-pulse"></div>
            <div className="h-8 bg-white/10 rounded-full w-20 animate-skeleton-pulse"></div>
          </div>
          <div className="flex gap-3 pt-2">
            <div className="h-11 bg-white/15 rounded-full w-36 animate-skeleton-pulse"></div>
            <div className="h-11 bg-white/15 rounded-full w-32 animate-skeleton-pulse"></div>
            <div className="h-11 bg-white/15 rounded-full w-28 animate-skeleton-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
function TvShowDetailsContent() {
  const searchParams = useSearchParams();
  const tvId = searchParams.get("id") || "";
  const { data: session } = useSession();
  const user = session?.user as any;

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  // TV data
  const [tvShow, setTvShow] = useState<any>(null);
  const [cast, setCast] = useState<any[]>([]);
  const [creators, setCreators] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [similarShows, setSimilarShows] = useState<any[]>([]);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User interaction states
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [isWatched, setIsWatched] = useState(false);
  const [watchedLoading, setWatchedLoading] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [hoverRating, setHoverRating] = useState(5);
  const [isRatingSubmitting, setIsRatingSubmitting] = useState(false);

  // Reviews
  const [newReviewText, setNewReviewText] = useState("");
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false);
  const [dbReviews, setDbReviews] = useState<any[]>([]);
  const [reviewAvatars, setReviewAvatars] = useState<Record<string, string>>({});
  const [reviewRatings, setReviewRatings] = useState<Record<string, number>>({});
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [isEditingSubmitting, setIsEditingSubmitting] = useState(false);

  // UI
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const [expandedSeasonId, setExpandedSeasonId] = useState<number | null>(null);
  const [seasonEpisodes, setSeasonEpisodes] = useState<Record<number, any[]>>({});
  const [loadingEpisodes, setLoadingEpisodes] = useState<Record<number, boolean>>({});
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: "", visible: false });

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  }, []);

  // Scroll listener
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Load TV show data
  useEffect(() => {
    if (!tvId) { setLoading(false); return; }

    async function fetchTvDetails() {
      setLoading(true);
      setError(null);
      try {
        const [tvRes, creditsRes, similarRes, videosRes] = await Promise.all([
          fetch(`/api/tmdb?endpoint=tv/${tvId}`),
          fetch(`/api/tmdb?endpoint=tv/${tvId}/credits`),
          fetch(`/api/tmdb?endpoint=tv/${tvId}/similar`),
          fetch(`/api/tmdb?endpoint=tv/${tvId}/videos`),
        ]);

        if (!tvRes.ok) throw new Error(`Failed to fetch TV details (status ${tvRes.status})`);

        const tvData = await tvRes.json();
        const creditsData = await creditsRes.json();
        const similarData = await similarRes.json();
        const videosData = await videosRes.json();

        setTvShow(tvData);
        setCreators(tvData.created_by || []);
        setSeasons((tvData.seasons || []).filter((s: any) => s.season_number > 0)); // filter out specials

        if (creditsData.cast) setCast(creditsData.cast.slice(0, 12));

        if (similarData.results) setSimilarShows(similarData.results.slice(0, 8));

        if (videosData.results) {
          const trailer = videosData.results.find(
            (v: any) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser")
          );
          if (trailer) setTrailerKey(trailer.key);
          else {
            const any = videosData.results.find((v: any) => v.site === "YouTube");
            if (any) setTrailerKey(any.key);
          }
        }
      } catch (err: any) {
        console.error("Error loading TV details:", err);
        setError(err.message || "Failed to load TV show details.");
      } finally {
        setLoading(false);
      }
    }
    fetchTvDetails();
  }, [tvId]);

  // Load season episodes on expand
  const toggleSeason = async (seasonNumber: number) => {
    if (expandedSeasonId === seasonNumber) {
      setExpandedSeasonId(null);
      return;
    }
    setExpandedSeasonId(seasonNumber);
    if (seasonEpisodes[seasonNumber]) return; // already loaded

    setLoadingEpisodes(prev => ({ ...prev, [seasonNumber]: true }));
    try {
      const res = await fetch(`/api/tmdb?endpoint=tv/${tvId}/season/${seasonNumber}`);
      if (res.ok) {
        const data = await res.json();
        setSeasonEpisodes(prev => ({ ...prev, [seasonNumber]: data.episodes || [] }));
      }
    } catch (err) {
      console.error("Error loading episodes:", err);
    } finally {
      setLoadingEpisodes(prev => ({ ...prev, [seasonNumber]: false }));
    }
  };

  // Watchlist
  useEffect(() => {
    if (!user?.id || !tvId) return;
    supabase
      .from("watchlist")
      .select("id")
      .eq("user_id", user.id)
      .eq("movie_id", tvId)
      .eq("content_type", CONTENT_TYPE)
      .maybeSingle()
      .then(({ data }) => setIsInWatchlist(!!data));
  }, [user, tvId]);

  const handleWatchlistToggle = async () => {
    if (!user?.id || !tvShow) return;
    setWatchlistLoading(true);
    try {
      if (isInWatchlist) {
        const { error } = await supabase
          .from("watchlist")
          .delete()
          .eq("user_id", user.id)
          .eq("movie_id", tvId)
          .eq("content_type", CONTENT_TYPE);
        if (!error) { setIsInWatchlist(false); showToast("Removed from watchlist!"); }
      } else {
        const { error } = await supabase.from("watchlist").insert({
          user_id: user.id,
          movie_id: tvId,
          movie_title: tvShow.name || "Unknown Show",
          poster_path: tvShow.poster_path || "",
          content_type: CONTENT_TYPE,
        });
        if (!error) { setIsInWatchlist(true); showToast("Added to watchlist!"); }
      }
    } catch (err) {
      console.error("Error toggling watchlist:", err);
    } finally {
      setWatchlistLoading(false);
    }
  };

  // Watched
  useEffect(() => {
    if (!user?.id || !tvId) return;
    fetch(`/api/watched?userId=${user.id}&movieId=${tvId}&contentType=${CONTENT_TYPE}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setIsWatched(!!data));
  }, [user, tvId]);

  const handleWatchedToggle = async () => {
    if (!user?.id || !tvShow) return;
    setWatchedLoading(true);
    try {
      if (isWatched) {
        const res = await fetch(`/api/watched?userId=${user.id}&movieId=${tvId}&contentType=${CONTENT_TYPE}`, { method: "DELETE" });
        if (res.ok) { setIsWatched(false); showToast("Removed from watched!"); }
      } else {
        const res = await fetch("/api/watched", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: user.id,
            movie_id: tvId,
            movie_title: tvShow.name || "Unknown Show",
            poster_path: tvShow.poster_path || "",
            content_type: CONTENT_TYPE,
          }),
        });
        if (res.ok) { setIsWatched(true); showToast("Marked as watched!"); }
      }
    } catch (err) {
      console.error("Error toggling watched:", err);
    } finally {
      setWatchedLoading(false);
    }
  };

  // Rating
  useEffect(() => {
    if (!user?.id || !tvId) return;
    supabase
      .from("ratings")
      .select("rating")
      .eq("user_id", user.id)
      .eq("movie_id", tvId)
      .eq("content_type", CONTENT_TYPE)
      .maybeSingle()
      .then(({ data }) => setUserRating(data?.rating ?? null));
  }, [user, tvId]);

  const handleRatingSubmit = async (ratingVal: number) => {
    if (!user?.id || !tvId) return;
    setIsRatingSubmitting(true);
    try {
      const { error } = await supabase.from("ratings").upsert(
        { user_id: user.id, movie_id: tvId, rating: ratingVal, content_type: CONTENT_TYPE, created_at: new Date().toISOString() },
        { onConflict: "user_id,movie_id,content_type" }
      );
      if (!error) { setUserRating(ratingVal); setShowRatingModal(false); showToast("Rating saved!"); }
    } catch (err) {
      console.error("Error submitting rating:", err);
    } finally {
      setIsRatingSubmitting(false);
    }
  };

  // Reviews
  useEffect(() => {
    if (!tvId) return;
    async function fetchReviews() {
      try {
        const { data, error } = await supabase
          .from("reviews")
          .select("*")
          .eq("movie_id", tvId)
          .eq("content_type", CONTENT_TYPE)
          .order("created_at", { ascending: false });

        if (data && data.length > 0) {
          setDbReviews(data);
          const userIds = Array.from(new Set(data.map((r: any) => r.user_id)));
          const [profilesRes, ratingsRes] = await Promise.all([
            supabase.from("profiles").select("user_id, avatar_url").in("user_id", userIds),
            supabase.from("ratings").select("user_id, rating").eq("movie_id", tvId).eq("content_type", CONTENT_TYPE).in("user_id", userIds),
          ]);
          const avatarsMap: Record<string, string> = {};
          profilesRes.data?.forEach((p: any) => { if (p.avatar_url) avatarsMap[p.user_id] = p.avatar_url; });
          setReviewAvatars(avatarsMap);
          const ratingsMap: Record<string, number> = {};
          ratingsRes.data?.forEach((r: any) => { ratingsMap[r.user_id] = r.rating; });
          setReviewRatings(ratingsMap);
        } else {
          setDbReviews([]);
        }
      } catch (err) {
        console.error("Error fetching reviews:", err);
      }
    }
    fetchReviews();
  }, [tvId]);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !tvId || !newReviewText.trim()) return;
    setIsReviewSubmitting(true);
    try {
      const newReview = {
        user_id: user.id,
        user_name: user.name || "Cine Member",
        movie_id: tvId,
        review_text: newReviewText.trim(),
        content_type: CONTENT_TYPE,
        created_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from("reviews").insert(newReview).select().single();
      if (!error && data) {
        setDbReviews([data, ...dbReviews]);
        setNewReviewText("");
        showToast("Review posted!");
      }
    } catch (err) {
      console.error("Error posting review:", err);
    } finally {
      setIsReviewSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm("Delete your review?")) return;
    const { error } = await supabase.from("reviews").delete().eq("id", reviewId);
    if (!error) { setDbReviews(prev => prev.filter(r => r.id !== reviewId)); showToast("Review deleted"); }
  };

  const handleStartEdit = (rev: any) => { setEditingReviewId(rev.id); setEditText(rev.review_text); };

  const handleSaveEdit = async (reviewId: string) => {
    if (!editText.trim()) return;
    setIsEditingSubmitting(true);
    try {
      const { error } = await supabase.from("reviews").update({ review_text: editText.trim() }).eq("id", reviewId);
      if (!error) {
        setDbReviews(prev => prev.map(r => r.id === reviewId ? { ...r, review_text: editText.trim() } : r));
        setEditingReviewId(null);
        showToast("Review updated!");
      }
    } catch (err) {
      console.error("Error updating review:", err);
    } finally {
      setIsEditingSubmitting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) return <DetailsSkeleton />;

  if (error || !tvShow) {
    return (
      <div className="bg-[#050505] text-[#e5e2e1] min-h-screen flex flex-col items-center justify-center p-6 gap-4">
        <span className="material-symbols-outlined text-[48px] text-purple-400">tv_off</span>
        <h2 className="font-serif text-2xl">TV Show Not Found</h2>
        <p className="text-on-surface-variant text-center max-w-md">{error || "Details could not be loaded."}</p>
        <Link href="/" className="bg-purple-600 text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 transition-opacity">Back to Home</Link>
      </div>
    );
  }

  const ratingValue = tvShow.vote_average ? tvShow.vote_average.toFixed(1) : "N/A";
  const firstAirYear = tvShow.first_air_date ? new Date(tvShow.first_air_date).getFullYear() : "";
  const lastAirYear = tvShow.last_air_date ? new Date(tvShow.last_air_date).getFullYear() : "";
  const yearRange = firstAirYear
    ? (tvShow.status === "Ended" && lastAirYear && lastAirYear !== firstAirYear
      ? `${firstAirYear}–${lastAirYear}`
      : String(firstAirYear))
    : "";

  return (
    <div className="bg-[#050505] text-[#e5e2e1] font-body-md overflow-x-clip min-h-screen relative pb-32">

      {/* Toast */}
      {toast.visible && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] bg-[#1a1a1a] border border-purple-500/40 text-[#e5e2e1] px-6 py-3 rounded-full shadow-2xl text-body-md animate-fade-in flex items-center gap-2">
          <span className="material-symbols-outlined text-purple-400 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-50 bg-gradient-to-b from-[#050505]/90 via-[#050505]/40 to-transparent flex justify-between items-center px-6 py-4 transition-all duration-300">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer text-purple-400 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <Link href="/" className="hover:opacity-90 transition-all block">
          <h1 className="font-display-md text-[24px] text-primary tracking-tighter uppercase select-none font-serif drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
            CINE SOCIAL
          </h1>
        </Link>
        <div className="flex items-center gap-4">
          <NotificationBell />
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-8 h-8 rounded-full overflow-hidden border border-white/10 hover:opacity-80 transition-all focus:outline-none cursor-pointer flex items-center justify-center bg-white/5"
            >
              <img alt={user?.name || "User"} className="w-full h-full object-cover" src={getAvatarUrlOrDefault(user?.image)} />
            </button>
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#131313]/90 border border-white/10 backdrop-blur-md p-2 shadow-2xl z-50 animate-fade-in">
                <div className="px-3 py-2 border-b border-white/10 mb-1">
                  <p className="text-body-md font-semibold truncate">{user?.name || "Cine Member"}</p>
                  <p className="text-label-sm text-on-surface-variant truncate opacity-60">{user?.email || ""}</p>
                </div>
                <button onClick={() => signOut({ callbackUrl: "/auth/signin" })} className="w-full text-left px-3 py-2 rounded-lg text-primary hover:bg-white/5 transition-colors flex items-center gap-2 font-semibold cursor-pointer border-none bg-transparent">
                  <span className="material-symbols-outlined text-sm">logout</span> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Backdrop */}
      <main className="relative pt-[60px]">
        <section className="relative h-[574px] w-full overflow-hidden">
          <img
            className="w-full h-full object-cover scale-105 transition-transform duration-100"
            style={{ transform: `scale(1.05) translateY(${scrollY * 0.3}px)` }}
            alt={tvShow.name || "TV Show Backdrop"}
            src={tvShow.backdrop_path
              ? `https://image.tmdb.org/t/p/original${tvShow.backdrop_path}`
              : "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=1600"}
          />
          {/* Purple-tinted gradient for TV shows */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #050505 0%, rgba(88,28,135,0.15) 50%, transparent 100%)" }}></div>
        </section>

        {/* Poster + Info */}
        <div className="px-6 -mt-40 relative z-10 max-w-screen-xl mx-auto w-full">
          <div className="flex flex-col md:flex-row gap-6 md:gap-10">
            {/* Poster */}
            <div className="w-40 md:w-64 flex-shrink-0 mx-auto md:mx-0">
              <div className="rounded-xl overflow-hidden shadow-2xl border border-purple-500/20 aspect-[2/3] relative">
                <img
                  className="w-full h-full object-cover"
                  alt={tvShow.name || "TV Show Poster"}
                  src={tvShow.poster_path
                    ? `https://image.tmdb.org/t/p/w500${tvShow.poster_path}`
                    : "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=500"}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                {/* TV Show badge */}
                <span className="absolute top-2 left-2 bg-purple-600/90 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded backdrop-blur-md border border-purple-400/30">
                  TV Show
                </span>
              </div>
            </div>

            {/* Details */}
            <div className="flex-grow pt-10 md:pt-20">
              <h2 className="font-headline-lg text-headline-lg text-on-surface mb-2 tracking-tight font-serif">
                {tvShow.name}
              </h2>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-3 mb-4 text-body-md">
                <div className="flex items-center gap-1 text-secondary">
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  <span className="font-bold text-title-lg">{ratingValue}</span>
                  <span className="text-on-surface-variant opacity-60">/10</span>
                </div>
                <div className="h-4 w-px bg-white/20"></div>
                {yearRange && <span className="text-on-surface-variant">{yearRange}</span>}
                {tvShow.number_of_seasons && (
                  <>
                    <div className="h-4 w-px bg-white/20"></div>
                    <span className="text-on-surface-variant">{tvShow.number_of_seasons} {tvShow.number_of_seasons === 1 ? "Season" : "Seasons"}</span>
                  </>
                )}
                {tvShow.number_of_episodes && (
                  <>
                    <div className="h-4 w-px bg-white/20"></div>
                    <span className="text-on-surface-variant">{tvShow.number_of_episodes} Episodes</span>
                  </>
                )}
                {tvShow.status && (
                  <>
                    <div className="h-4 w-px bg-white/20"></div>
                    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${tvShow.status === "Ended" ? "bg-white/10 text-on-surface-variant" : "bg-green-500/20 text-green-400 border border-green-500/30"}`}>
                      {tvShow.status}
                    </span>
                  </>
                )}
              </div>

              {/* Genre pills */}
              {tvShow.genres && tvShow.genres.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {tvShow.genres.map((g: any) => (
                    <span key={g.id} className="px-3 py-1 rounded-full text-label-sm text-purple-300 border border-purple-500/30 bg-purple-500/10 uppercase">
                      {g.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Creators */}
              {creators.length > 0 && (
                <div className="flex items-center gap-2 mb-4 flex-wrap text-body-md">
                  <span className="text-on-surface-variant opacity-70">Created by</span>
                  {creators.map((c: any, idx: number) => (
                    <React.Fragment key={c.id}>
                      {idx > 0 && <span className="text-on-surface-variant opacity-40">,</span>}
                      <span className="text-purple-300 font-semibold bg-purple-500/10 hover:bg-purple-500/20 px-3.5 py-1 rounded-full border border-purple-500/30 transition-all text-xs flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">tv</span>
                        {c.name}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              )}

              {/* Networks */}
              {tvShow.networks && tvShow.networks.length > 0 && (
                <div className="flex items-center gap-2 mb-5 flex-wrap text-body-md">
                  <span className="text-on-surface-variant opacity-70">Network</span>
                  {tvShow.networks.map((n: any) => (
                    <span key={n.id} className="text-xs text-on-surface-variant border border-white/10 bg-white/5 px-3 py-0.5 rounded-full">
                      {n.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                {/* Watchlist */}
                <button
                  onClick={handleWatchlistToggle}
                  disabled={watchlistLoading}
                  className={`px-6 py-3 rounded-full font-title-lg flex items-center gap-2 active:scale-95 transition-all duration-200 cursor-pointer border-none ${
                    isInWatchlist
                      ? "bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.35)]"
                      : "bg-purple-900/60 text-purple-200 hover:bg-purple-800/60"
                  }`}
                >
                  {watchlistLoading
                    ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    : <span className="material-symbols-outlined" style={{ fontVariationSettings: isInWatchlist ? "'FILL' 1" : "" }}>{isInWatchlist ? "bookmark_added" : "bookmark_add"}</span>
                  }
                  {isInWatchlist ? "In Watchlist" : "Add to Watchlist"}
                </button>

                {/* Watched */}
                <button
                  onClick={handleWatchedToggle}
                  disabled={watchedLoading}
                  className={`px-6 py-3 rounded-full font-title-lg flex items-center gap-2 active:scale-95 transition-all duration-200 cursor-pointer border-none ${
                    isWatched
                      ? "bg-secondary text-black shadow-[0_0_20px_rgba(233,195,73,0.35)]"
                      : "bg-primary-container text-on-primary-container"
                  }`}
                >
                  {watchedLoading
                    ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    : <span className="material-symbols-outlined" style={{ fontVariationSettings: isWatched ? "'FILL' 1" : "" }}>{isWatched ? "visibility" : "visibility_off"}</span>
                  }
                  {isWatched ? "Watched" : "Mark as Watched"}
                </button>

                {/* Trailer */}
                {trailerKey && (
                  <button
                    onClick={() => setShowTrailerModal(true)}
                    className="px-6 py-3 rounded-full font-title-lg flex items-center gap-2 active:scale-95 transition-all duration-200 bg-[#e5e2e1] text-black hover:bg-white cursor-pointer border-none"
                  >
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
                    Watch Trailer
                  </button>
                )}

                {/* Rate */}
                <button
                  onClick={() => { setHoverRating(userRating || 5); setShowRatingModal(true); }}
                  className={`px-6 py-3 rounded-full font-title-lg flex items-center gap-2 active:scale-95 transition-all duration-200 glass-card cursor-pointer border ${
                    userRating
                      ? "border-purple-400 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                      : "border-secondary text-secondary"
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>grade</span>
                  {userRating ? `Your Rating: ${userRating}/10` : "Rate Now"}
                </button>
              </div>
            </div>
          </div>

          {/* Synopsis */}
          <section className="mt-10 max-w-3xl">
            <h3 className="font-title-lg text-title-lg text-purple-300 mb-3 uppercase tracking-widest font-serif">Synopsis</h3>
            <p className="text-on-surface-variant text-body-lg leading-relaxed opacity-90">
              {tvShow.overview || "No synopsis available for this show."}
            </p>
          </section>

          {/* Seasons & Episodes */}
          {seasons.length > 0 && (
            <section className="mt-10">
              <h3 className="font-title-lg text-title-lg text-purple-300 mb-4 uppercase tracking-widest font-serif">
                Seasons & Episodes
              </h3>
              <div className="space-y-3 max-w-4xl">
                {seasons.map((season: any) => (
                  <div key={season.id} className="glass-card rounded-xl border border-white/10 overflow-hidden">
                    <button
                      onClick={() => toggleSeason(season.season_number)}
                      className="w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-colors cursor-pointer text-left"
                    >
                      <img
                        src={season.poster_path ? `https://image.tmdb.org/t/p/w92${season.poster_path}` : "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=100"}
                        alt={season.name}
                        className="w-12 h-16 object-cover rounded-lg flex-shrink-0 border border-white/10"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-on-surface truncate">{season.name}</p>
                        <p className="text-label-sm text-on-surface-variant opacity-60">
                          {season.episode_count} Episodes
                          {season.air_date ? ` • ${new Date(season.air_date).getFullYear()}` : ""}
                        </p>
                      </div>
                      <span className={`material-symbols-outlined text-on-surface-variant transition-transform duration-200 flex-shrink-0 ${expandedSeasonId === season.season_number ? "rotate-180" : ""}`}>
                        expand_more
                      </span>
                    </button>

                    {expandedSeasonId === season.season_number && (
                      <div className="border-t border-white/10 p-4">
                        {loadingEpisodes[season.season_number] ? (
                          <div className="flex justify-center py-4">
                            <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {(seasonEpisodes[season.season_number] || []).map((ep: any) => (
                              <div key={ep.id} className="flex gap-3 items-start group/ep hover:bg-white/5 rounded-lg p-2 transition-colors">
                                <div className="flex-shrink-0 w-28 md:w-36">
                                  <div className="aspect-video rounded-lg overflow-hidden bg-white/5 border border-white/10">
                                    <img
                                      src={ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=300"}
                                      alt={ep.name}
                                      className="w-full h-full object-cover group-hover/ep:scale-105 transition-transform duration-300"
                                    />
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-body-md text-on-surface truncate">
                                    <span className="text-on-surface-variant opacity-50 mr-1">E{ep.episode_number}</span>
                                    {ep.name}
                                  </p>
                                  {ep.runtime && (
                                    <p className="text-label-sm text-on-surface-variant opacity-50">{ep.runtime}m</p>
                                  )}
                                  {ep.overview && (
                                    <p className="text-label-sm text-on-surface-variant opacity-70 line-clamp-2 mt-1">{ep.overview}</p>
                                  )}
                                </div>
                                {ep.vote_average > 0 && (
                                  <div className="flex-shrink-0 flex items-center gap-1 text-secondary text-xs font-bold">
                                    <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                    {ep.vote_average.toFixed(1)}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Cast Carousel */}
          {cast.length > 0 && (
            <section className="mt-10">
              <h3 className="font-title-lg text-title-lg text-purple-300 mb-4 uppercase tracking-widest font-serif">Ensemble Cast</h3>
              <Carousel containerClassName="gap-4 pb-4">
                {cast.map((actor: any) => (
                  <Link
                    key={actor.id}
                    href={`/person/${actor.id}`}
                    className="flex-shrink-0 w-24 text-center group/card cursor-pointer block"
                  >
                    <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-transparent group-hover/card:border-purple-400 transition-all mb-2 shadow-lg bg-white/5">
                      <img
                        className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300"
                        alt={actor.name}
                        src={actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}
                        draggable={false}
                      />
                    </div>
                    <span className="block text-body-md text-on-surface font-semibold truncate group-hover/card:text-purple-300 transition-colors">{actor.name}</span>
                    <span className="block text-label-sm text-on-surface-variant opacity-60 truncate">{actor.character}</span>
                  </Link>
                ))}
              </Carousel>
            </section>
          )}

          {/* Reviews */}
          <section className="mt-10">
            <h3 className="font-title-lg text-title-lg text-purple-300 mb-4 uppercase tracking-widest font-serif">Community Pulse</h3>

            {/* Write Review */}
            <div className="glass-card p-6 rounded-xl border border-purple-500/20 mb-6 max-w-3xl">
              <h4 className="font-title-lg text-title-lg text-purple-300 mb-3 font-serif uppercase tracking-widest">Leave a Review</h4>
              {user ? (
                <form onSubmit={handleReviewSubmit} className="space-y-4">
                  <textarea
                    value={newReviewText}
                    onChange={(e) => setNewReviewText(e.target.value)}
                    placeholder="Share your thoughts about this show..."
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all font-body-md"
                    required
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-label-sm text-on-surface-variant opacity-55">
                      Logged in as {user.name || "Cine Member"}
                    </span>
                    <button
                      type="submit"
                      disabled={isReviewSubmitting || !newReviewText.trim()}
                      className="bg-purple-600 text-white px-6 py-2.5 rounded-full font-semibold flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 cursor-pointer text-body-md"
                    >
                      {isReviewSubmitting
                        ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        : <span className="material-symbols-outlined text-sm">send</span>
                      }
                      Post Review
                    </button>
                  </div>
                </form>
              ) : (
                <p className="text-on-surface-variant text-body-md">
                  <Link href="/auth/signin" className="text-purple-300 hover:underline">Sign in</Link> to leave a review.
                </p>
              )}
            </div>

            {/* Review cards */}
            {dbReviews.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dbReviews.map((rev: any) => (
                  <ReviewCard
                    key={rev.id}
                    review={rev}
                    currentUserId={user?.id}
                    currentUserName={user?.name}
                    currentUserAvatar={user?.image}
                    avatarUrl={reviewAvatars[rev.user_id]}
                    userRating={reviewRatings[rev.user_id]}
                    movieTitle={tvShow?.name}
                    onEdit={handleStartEdit}
                    onDelete={handleDeleteReview}
                    isEditing={editingReviewId === rev.id}
                    editText={editText}
                    setEditText={setEditText}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={() => setEditingReviewId(null)}
                    isEditingSubmitting={isEditingSubmitting}
                  />
                ))}
              </div>
            ) : (
              <p className="text-on-surface-variant opacity-60 text-body-md">No reviews yet. Be the first to share your thoughts!</p>
            )}
          </section>

          {/* Similar Shows */}
          {similarShows.length > 0 && (
            <section className="mt-10">
              <h3 className="font-title-lg text-title-lg text-purple-300 mb-4 uppercase tracking-widest font-serif">More Like This</h3>
              <Carousel containerClassName="gap-4 pb-4">
                {similarShows.map((show: any) => (
                  <Link
                    key={show.id}
                    href={`/tv?id=${show.id}`}
                    className="flex-shrink-0 w-[140px] md:w-[160px] group/card cursor-pointer block"
                  >
                    <div className="aspect-[2/3] rounded-xl overflow-hidden border border-white/10 bg-white/5 mb-2 relative">
                      <img
                        className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
                        alt={show.name || "TV Show"}
                        src={show.poster_path ? `https://image.tmdb.org/t/p/w342${show.poster_path}` : "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=342"}
                        draggable={false}
                      />
                    </div>
                    <span className="block text-body-md font-semibold group-hover/card:text-purple-300 truncate transition-colors">{show.name}</span>
                    {show.vote_average > 0 && (
                      <span className="flex items-center gap-1 text-secondary text-label-sm font-bold">
                        <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                        {show.vote_average.toFixed(1)}
                      </span>
                    )}
                  </Link>
                ))}
              </Carousel>
            </section>
          )}
        </div>
      </main>

      {/* Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowRatingModal(false)}>
          <div className="glass-card rounded-2xl p-8 max-w-sm w-full border border-purple-500/30 shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-xl text-center mb-2">Rate this Show</h3>
            <p className="text-on-surface-variant text-center text-sm mb-6">{tvShow.name}</p>
            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => setHoverRating(n)}
                  onMouseEnter={() => setHoverRating(n)}
                  className={`w-9 h-9 rounded-full font-bold text-sm transition-all cursor-pointer border-none ${
                    n <= hoverRating ? "bg-purple-500 text-white scale-110" : "bg-white/10 text-on-surface-variant"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-center text-purple-300 font-bold text-2xl mb-6">{hoverRating}/10</p>
            <button
              onClick={() => handleRatingSubmit(hoverRating)}
              disabled={isRatingSubmitting}
              className="w-full bg-purple-600 text-white py-3 rounded-full font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isRatingSubmitting ? "Saving..." : "Submit Rating"}
            </button>
          </div>
        </div>
      )}

      {/* Trailer Modal */}
      {showTrailerModal && trailerKey && (
        <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4" onClick={() => setShowTrailerModal(false)}>
          <div className="relative w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            <button onClick={() => setShowTrailerModal(false)} className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black cursor-pointer border-none">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
            <iframe
              src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1`}
              title="TV Show Trailer"
              className="w-full h-full border-none"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function TvShowDetailsPage() {
  return (
    <Suspense fallback={<DetailsSkeleton />}>
      <TvShowDetailsContent />
    </Suspense>
  );
}
