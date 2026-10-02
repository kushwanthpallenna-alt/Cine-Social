"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { supabase } from "@/lib/supabase";
import NotificationBell from "@/components/NotificationBell";
import ReviewCard from "@/components/ReviewCard";
import Carousel from "@/components/Carousel";
import PosterPickerModal from "@/components/PosterPickerModal";
import AddToListModal from "@/components/AddToListModal";
import { getAvatarUrlOrDefault } from "@/lib/avatar";
import { getTvUrl } from "@/lib/slug";

const CONTENT_TYPE = "tv";

// ─── Skeleton ────────────────────────────────────────────────────────────────
export const DetailsSkeleton = () => (
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
export default function TvDetailsClient({ tvId, initialSlug }: { tvId: string; initialSlug?: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user as any;

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
  const [userLiked, setUserLiked] = useState<boolean>(false);
  const [modalLiked, setModalLiked] = useState<boolean>(false);
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

  // Poster preference
  const [preferredPoster, setPreferredPoster] = useState<string | null>(null);
  const [showPosterPicker, setShowPosterPicker] = useState(false);
  const [showPosterConfirm, setShowPosterConfirm] = useState(false);

  // Custom List & Watched Date states
  const [showAddToListModal, setShowAddToListModal] = useState(false);
  const [showWatchedDatePicker, setShowWatchedDatePicker] = useState(false);
  const [watchedDate, setWatchedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [watchedAtTimestamp, setWatchedAtTimestamp] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  }, []);

  // Update browser address bar to include slug
  useEffect(() => {
    if (tvShow?.id && typeof window !== "undefined") {
      const canonicalUrl = getTvUrl(tvShow.id, tvShow.name);
      if (window.location.pathname !== canonicalUrl) {
        window.history.replaceState(null, "", canonicalUrl);
      }
    }
  }, [tvShow]);

  // Fetch this user's preferred poster for this TV show
  useEffect(() => {
    if (!user?.id || !tvId) return;
    const userId = user.id;
    fetch(`/api/poster-preference?userId=${encodeURIComponent(userId)}&movieId=${encodeURIComponent(tvId)}&contentType=tv`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.poster_path) setPreferredPoster(data.poster_path);
      })
      .catch(() => { });
  }, [user, tvId]);

  const handlePosterSelect = useCallback((posterPath: string | null) => {
    setPreferredPoster(posterPath);
    showToast(posterPath ? "Poster updated!" : "Poster reset to default!");
  }, [showToast]);

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
        setSeasons((tvData.seasons || []).filter((s: any) => s.season_number > 0));

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
    if (seasonEpisodes[seasonNumber]) return;

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
    if (!user?.id || !tvShow) {
      if (!user?.id && typeof window !== "undefined") {
        window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      }
      return;
    }
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
      .then(data => {
        setIsWatched(!!data);
        if (data?.watched_at) {
          setWatchedAtTimestamp(data.watched_at);
          setWatchedDate(new Date(data.watched_at).toISOString().split("T")[0]);
        }
      });
  }, [user, tvId]);

  const handleWatchedToggle = async (customDate?: string) => {
    if (!user?.id || !tvShow) {
      if (!user?.id && typeof window !== "undefined") {
        window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      }
      return;
    }
    setWatchedLoading(true);
    try {
      if (isWatched && !customDate) {
        const res = await fetch(`/api/watched?userId=${user.id}&movieId=${tvId}&contentType=${CONTENT_TYPE}`, { method: "DELETE" });
        if (res.ok) {
          setIsWatched(false);
          setWatchedAtTimestamp(null);
          showToast("Removed from watched!");
        }
      } else {
        const targetDate = customDate || watchedDate;
        const res = await fetch("/api/watched", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: user.id,
            movie_id: tvId,
            movie_title: tvShow.name || "Unknown Show",
            poster_path: preferredPoster || tvShow.poster_path || "",
            content_type: CONTENT_TYPE,
            watched_at: targetDate ? new Date(targetDate).toISOString() : undefined,
          }),
        });
        if (res.ok) {
          setIsWatched(true);
          const savedTimestamp = targetDate ? new Date(targetDate).toISOString() : new Date().toISOString();
          setWatchedAtTimestamp(savedTimestamp);
          setWatchedDate(savedTimestamp.split("T")[0]);
          if (isInWatchlist) {
            await supabase
              .from("watchlist")
              .delete()
              .eq("user_id", user.id)
              .eq("movie_id", tvId)
              .eq("content_type", CONTENT_TYPE);
            setIsInWatchlist(false);
          }
          showToast(isWatched ? "Updated watched date!" : "Marked as watched!");
          setShowWatchedDatePicker(false);
        }
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
      .select("rating, liked")
      .eq("user_id", user.id)
      .eq("movie_id", tvId)
      .eq("content_type", CONTENT_TYPE)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setUserRating(data.rating !== null && data.rating !== undefined ? Number(data.rating) : null);
          setUserLiked(!!data.liked);
        } else {
          setUserRating(null);
          setUserLiked(false);
        }
      });
  }, [user, tvId]);

  const handleRatingSubmit = async (ratingVal: number) => {
    if (!user?.id || !tvId) return;
    setIsRatingSubmitting(true);
    try {
      const ratingPayload: any = {
        user_id: user.id,
        movie_id: tvId,
        rating: ratingVal,
        liked: modalLiked,
        content_type: CONTENT_TYPE,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("ratings").upsert(
        ratingPayload,
        { onConflict: "user_id,movie_id,content_type" }
      );

      if (!error) {
        setUserRating(ratingVal);
        setUserLiked(modalLiked);
        setShowRatingModal(false);

        if (!isWatched) {
          await fetch("/api/watched", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: user.id,
              movie_id: tvId,
              movie_title: tvShow?.name || "Unknown Show",
              poster_path: tvShow?.poster_path || "",
              content_type: CONTENT_TYPE,
            }),
          });
          setIsWatched(true);
        }

        if (isInWatchlist) {
          await supabase
            .from("watchlist")
            .delete()
            .eq("user_id", user.id)
            .eq("movie_id", tvId)
            .eq("content_type", CONTENT_TYPE);
          setIsInWatchlist(false);
        }

        showToast("Rating saved!");
      } else {
        showToast("Failed to save rating");
      }
    } catch (err) {
      console.error("Error submitting rating:", err);
      showToast("Error submitting rating");
    } finally {
      setIsRatingSubmitting(false);
    }
  };

  const handleRatingDelete = async () => {
    if (!user?.id || !tvId) return;
    setIsRatingSubmitting(true);
    try {
      const { error } = await supabase
        .from("ratings")
        .delete()
        .eq("user_id", user.id)
        .eq("movie_id", tvId)
        .eq("content_type", CONTENT_TYPE);

      if (!error) {
        setUserRating(null);
        setUserLiked(false);
        setModalLiked(false);
        setShowRatingModal(false);
        showToast("Rating removed");
      } else {
        showToast("Failed to remove rating");
      }
    } catch (err) {
      console.error("Error deleting rating:", err);
      showToast("Error deleting rating");
    } finally {
      setIsRatingSubmitting(false);
    }
  };

  // Reviews
  useEffect(() => {
    if (!tvId) return;
    async function fetchReviews() {
      try {
        const { data } = await supabase
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
    if (!user?.id) {
      if (typeof window !== "undefined") {
        window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      }
      return;
    }
    if (!tvId || !newReviewText.trim()) return;
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
      <header
        className={`fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 transition-all duration-300 ${
          scrolled
            ? "py-3 bg-[#131313]/90 backdrop-blur-md border-b border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]"
            : "py-4 bg-gradient-to-b from-[#050505]/90 via-[#050505]/40 to-transparent border-none"
        }`}
      >
        <button
          onClick={handleBack}
          aria-label="Go back"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer text-purple-400 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)] bg-transparent border-none p-0"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
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
              {user?.image ? (
                <img alt={user?.name || "User"} className="w-full h-full object-cover" src={getAvatarUrlOrDefault(user.image)} />
              ) : (
                <span className="material-symbols-outlined text-on-surface-variant text-base">person</span>
              )}
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
            alt={tvShow.name || "TV Show Backdrop"}
            src={tvShow.backdrop_path
              ? `https://image.tmdb.org/t/p/original${tvShow.backdrop_path}`
              : "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=1600"}
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #050505 0%, rgba(88,28,135,0.15) 50%, transparent 100%)" }}></div>
        </section>

        {/* Poster + Info */}
        <div className="px-6 -mt-40 relative z-10 max-w-screen-xl mx-auto w-full">
          <div className="flex flex-col md:flex-row gap-6 md:gap-10">
            {/* Poster */}
            <div className="w-40 md:w-64 flex-shrink-0 mx-auto md:mx-0 group/poster relative">
              <div className="rounded-xl overflow-hidden shadow-2xl border border-purple-500/20 aspect-[2/3] relative">
                <img
                  className="w-full h-full object-cover transition-transform duration-700 group-hover/poster:scale-110"
                  alt={tvShow.name || "TV Show Poster"}
                  src={(preferredPoster ?? tvShow.poster_path)
                    ? `https://image.tmdb.org/t/p/w500${preferredPoster ?? tvShow.poster_path}`
                    : "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=500"}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                <span className="absolute top-2 left-2 bg-purple-600/90 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded backdrop-blur-md border border-purple-400/30">
                  TV Show
                </span>

                {user?.id && (
                  <>
                    <button
                      onClick={() => setShowPosterPicker(true)}
                      title="Change poster"
                      aria-label="Change poster"
                      className="hidden md:flex absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md items-center justify-center text-white border border-white/20 transition-all duration-200 cursor-pointer shadow-lg hover:scale-110 active:scale-95 opacity-0 group-hover/poster:opacity-100"
                    >
                      <span className="material-symbols-outlined text-[16px]">collections</span>
                    </button>

                    <button
                      onClick={() => setShowPosterConfirm(true)}
                      aria-label="Change poster"
                      className="md:hidden absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-white text-[11px] font-bold shadow-lg active:scale-95 transition-transform cursor-pointer whitespace-nowrap"
                    >
                      <span className="material-symbols-outlined text-[13px]">edit</span>
                      Edit Poster
                    </button>
                  </>
                )}
              </div>

              {preferredPoster && preferredPoster !== tvShow.poster_path && (
                <div className="flex items-center gap-1 mt-1.5 justify-center">
                  <span className="material-symbols-outlined text-[12px] text-purple-400">auto_awesome</span>
                  <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">Custom</span>
                </div>
              )}
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

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleWatchedToggle()}
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

                  {user?.id && (
                    <button
                      onClick={() => setShowWatchedDatePicker(true)}
                      title={isWatched ? "Change watched date" : "Set custom watched date"}
                      className={`p-3 rounded-full flex items-center justify-center transition-all cursor-pointer border ${
                        isWatched
                          ? "bg-secondary/20 text-secondary border-secondary/30 hover:bg-secondary/30"
                          : "glass-card text-on-surface-variant hover:text-white border-white/10"
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">calendar_month</span>
                    </button>
                  )}
                </div>

                <button
                  onClick={() => {
                    if (!user?.id) {
                      if (typeof window !== "undefined") {
                        window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`;
                      }
                      return;
                    }
                    setShowAddToListModal(true);
                  }}
                  className="px-6 py-3 rounded-full font-title-lg flex items-center gap-2 active:scale-95 transition-all duration-200 glass-card cursor-pointer border border-white/10 text-on-surface hover:border-purple-400/50 hover:text-purple-300"
                >
                  <span className="material-symbols-outlined">playlist_add</span>
                  Add to List
                </button>

                {trailerKey && (
                  <button
                    onClick={() => setShowTrailerModal(true)}
                    className="px-6 py-3 rounded-full font-title-lg flex items-center gap-2 active:scale-95 transition-all duration-200 bg-[#e5e2e1] text-black hover:bg-white cursor-pointer border-none"
                  >
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
                    Watch Trailer
                  </button>
                )}

                <button
                  onClick={() => {
                    if (!user?.id) {
                      if (typeof window !== "undefined") {
                        window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`;
                      }
                      return;
                    }
                    setHoverRating(userRating || 5);
                    setModalLiked(userLiked);
                    setShowRatingModal(true);
                  }}
                  className={`px-6 py-3 rounded-full font-title-lg flex items-center gap-2 active:scale-95 transition-all duration-200 glass-card cursor-pointer border ${
                    userRating
                      ? "border-purple-400 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                      : "border-secondary text-secondary"
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>grade</span>
                  {userRating !== null ? `Your Rating: ${userRating % 1 === 0 ? userRating : userRating.toFixed(1)}/10` : "Rate Now"}
                  {userLiked && (
                    <span
                      className="material-symbols-outlined text-red-400 text-sm ml-0.5"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                      title="Liked"
                    >
                      favorite
                    </span>
                  )}
                </button>

                <button
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: tvShow.name || "TV Show",
                        text: `Check out ${tvShow.name} on CineSocial`,
                        url: window.location.href,
                      }).catch(() => {});
                    } else if (navigator.clipboard) {
                      navigator.clipboard.writeText(window.location.href);
                      showToast("Link copied to clipboard!");
                    }
                  }}
                  className="glass-card text-on-surface p-3 rounded-full active:scale-90 transition-transform cursor-pointer"
                  title="Share TV show"
                >
                  <span className="material-symbols-outlined">share</span>
                </button>
              </div>

              {/* Watched Date indicator */}
              {isWatched && watchedAtTimestamp && (
                <div className="flex items-center gap-2 mt-3 text-xs text-on-surface-variant/80">
                  <span className="material-symbols-outlined text-sm text-secondary">event_available</span>
                  <span>
                    Watched on <strong className="text-on-surface">{new Date(watchedAtTimestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</strong>
                  </span>
                  <button
                    onClick={() => setShowWatchedDatePicker(true)}
                    className="text-purple-300 hover:underline ml-1 cursor-pointer bg-transparent border-none p-0 text-xs font-semibold"
                  >
                    Edit date
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Synopsis */}
          <section className="mt-12 max-w-3xl">
            <h3 className="font-title-lg text-title-lg text-purple-300 mb-3 uppercase tracking-widest font-serif">Overview</h3>
            <p className="text-on-surface-variant text-body-lg leading-relaxed opacity-90">
              {tvShow.overview || "No overview available."}
            </p>
          </section>

          {/* Cast */}
          {cast.length > 0 && (
            <section className="mt-12">
              <h3 className="font-title-lg text-title-lg text-purple-300 mb-4 uppercase tracking-widest font-serif">Cast</h3>
              <Carousel containerClassName="gap-6 pb-4">
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

          {/* Seasons */}
          {seasons.length > 0 && (
            <section className="mt-12">
              <h3 className="font-title-lg text-title-lg text-purple-300 mb-4 uppercase tracking-widest font-serif">
                Seasons &amp; Episodes ({seasons.length})
              </h3>
              <div className="space-y-3 max-w-3xl">
                {seasons.map((season: any) => {
                  const isExpanded = expandedSeasonId === season.season_number;
                  const episodes = seasonEpisodes[season.season_number] || [];
                  const isLoading = loadingEpisodes[season.season_number];

                  return (
                    <div key={season.id} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden transition-colors">
                      <button
                        onClick={() => toggleSeason(season.season_number)}
                        className="w-full flex items-center justify-between p-4 text-left cursor-pointer hover:bg-white/5 transition-colors border-none bg-transparent"
                      >
                        <div className="flex items-center gap-4">
                          {season.poster_path && (
                            <img
                              src={`https://image.tmdb.org/t/p/w92${season.poster_path}`}
                              alt={season.name}
                              className="w-10 h-14 object-cover rounded-md flex-shrink-0"
                            />
                          )}
                          <div>
                            <h4 className="font-bold text-on-surface text-base">{season.name}</h4>
                            <p className="text-on-surface-variant text-xs mt-0.5">
                              {season.episode_count} Episodes {season.air_date ? `• ${new Date(season.air_date).getFullYear()}` : ""}
                            </p>
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-on-surface-variant text-xl transition-transform duration-200" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                          expand_more
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-white/10 p-4 space-y-3 bg-black/30">
                          {season.overview && (
                            <p className="text-on-surface-variant text-xs italic mb-3 opacity-80">{season.overview}</p>
                          )}
                          {isLoading ? (
                            <div className="flex justify-center py-6">
                              <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          ) : episodes.length > 0 ? (
                            episodes.map((ep: any) => (
                              <div key={ep.id} className="flex gap-3 items-start p-2.5 rounded-lg hover:bg-white/5 transition-colors">
                                <span className="text-purple-400 font-mono text-xs font-bold pt-0.5 w-6 flex-shrink-0">
                                  {ep.episode_number}
                                </span>
                                {ep.still_path && (
                                  <img
                                    src={`https://image.tmdb.org/t/p/w185${ep.still_path}`}
                                    alt={ep.name}
                                    className="w-20 aspect-video object-cover rounded flex-shrink-0 bg-white/5"
                                  />
                                )}
                                <div className="min-w-0 flex-grow">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-xs text-on-surface">{ep.name}</p>
                                    {ep.runtime && <span className="text-[10px] text-on-surface-variant opacity-50">{ep.runtime}m</span>}
                                    {ep.vote_average > 0 && (
                                      <span className="text-[10px] text-secondary font-bold flex items-center gap-0.5">
                                        ★ {ep.vote_average.toFixed(1)}
                                      </span>
                                    )}
                                  </div>
                                  {ep.overview && (
                                    <p className="text-on-surface-variant text-xs mt-1 line-clamp-2 opacity-70 leading-relaxed">
                                      {ep.overview}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-on-surface-variant text-xs opacity-50 text-center py-2">Episode details unavailable.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Reviews */}
          <section className="mt-12 max-w-3xl">
            <h3 className="font-title-lg text-title-lg text-purple-300 mb-6 uppercase tracking-widest font-serif">Community Reviews</h3>

            {/* Leave review form */}
            <div className="glass-card p-6 rounded-xl border border-white/10 mb-8">
              <h4 className="font-title-lg text-purple-300 mb-3 font-serif uppercase tracking-widest text-sm">Leave a Review</h4>
              <form onSubmit={handleReviewSubmit} className="space-y-4">
                <textarea
                  value={newReviewText}
                  onChange={(e) => setNewReviewText(e.target.value)}
                  placeholder={`What did you think of ${tvShow.name}?`}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all font-body-md text-sm"
                  required
                />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-on-surface-variant opacity-55">Logged in as {user?.name || "Cine Member"}</span>
                  <button
                    type="submit"
                    disabled={isReviewSubmitting || !newReviewText.trim()}
                    className="bg-purple-600 text-white px-6 py-2 rounded-full font-semibold flex items-center gap-2 hover:bg-purple-500 active:scale-95 transition-all disabled:opacity-50 cursor-pointer text-xs"
                  >
                    {isReviewSubmitting ? <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <span className="material-symbols-outlined text-xs">send</span>}
                    Post Review
                  </button>
                </div>
              </form>
            </div>

            {/* Reviews list */}
            {dbReviews.length > 0 ? (
              <div className="space-y-4">
                {dbReviews.map((rev) => (
                  <ReviewCard
                    key={rev.id}
                    review={rev}
                    currentUserId={user?.id}
                    currentUserName={user?.name}
                    currentUserAvatar={user?.image}
                    avatarUrl={reviewAvatars[rev.user_id]}
                    userRating={reviewRatings[rev.user_id]}
                    movieTitle={tvShow.name}
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
                    href={getTvUrl(show.id, show.name)}
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

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 h-[60px] z-50 mb-container-margin mx-container-margin rounded-full bg-surface/40 backdrop-blur-[100px] border border-white/10 flex justify-around items-center px-6 shadow-[0_0_20px_rgba(255,180,170,0.1)] max-w-md md:left-1/2 md:-translate-x-1/2">
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/"><span className="material-symbols-outlined">home</span></Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/recommendations"><span className="material-symbols-outlined">search</span></Link>
        <Link className="flex items-center justify-center text-primary relative after:content-[''] after:absolute after:-bottom-2 after:w-1 after:h-1 after:bg-primary after:rounded-full after:shadow-[0_0_8px_#ffb4aa] active:scale-90" href="/movies"><span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>bookmark</span></Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/community"><span className="material-symbols-outlined">group</span></Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/profile"><span className="material-symbols-outlined">person</span></Link>
      </nav>

      {/* Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in text-[#e5e2e1]">
          <div className="glass-panel max-w-sm w-full p-8 rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-center relative">
            <button onClick={() => setShowRatingModal(false)} className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface cursor-pointer border-none bg-transparent">
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="font-serif text-[26px] text-purple-300 mb-2">Rate {tvShow.name}</h3>
            <p className="text-on-surface-variant text-xs mb-6">How would you rate this TV series?</p>
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-purple-600 text-white font-serif text-[28px] flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.4)] animate-pulse mb-2">
                {((hoverRating || userRating || 5) % 1 === 0 ? (hoverRating || userRating || 5) : (hoverRating || userRating || 5).toFixed(1))}
              </div>
              <input
                type="range" min="1" max="10" step="0.5"
                value={hoverRating || userRating || 5}
                onChange={(e) => setHoverRating(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500 focus:outline-none"
              />
              <div className="flex justify-between w-full text-[10px] text-on-surface-variant uppercase tracking-widest px-1 font-bold opacity-60">
                <span>1 - Awful</span><span>5 - Good</span><span>10 - Masterpiece</span>
              </div>
            </div>
            <div className="mb-6 flex justify-center">
              <button
                type="button" onClick={() => setModalLiked(!modalLiked)}
                className={`flex items-center justify-center gap-2 py-2 px-5 rounded-full border transition-all cursor-pointer ${
                  modalLiked ? "bg-red-500/20 text-red-400 border-red-500/40 shadow-lg scale-105" : "bg-white/5 text-on-surface-variant hover:text-white border-white/10"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: modalLiked ? "'FILL' 1" : "" }}>favorite</span>
                <span className="text-xs font-semibold">{modalLiked ? "Liked this show" : "Like this show"}</span>
              </button>
            </div>
            <button
              onClick={() => handleRatingSubmit(hoverRating || userRating || 5)}
              disabled={isRatingSubmitting}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-full font-bold shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 text-sm"
            >
              {isRatingSubmitting && <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
              {userRating !== null ? "Update Rating" : "Confirm Rating"}
            </button>
            {userRating !== null && (
              <button
                type="button" onClick={handleRatingDelete} disabled={isRatingSubmitting}
                className="w-full mt-2.5 py-2 rounded-full border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">delete</span> Remove Rating
              </button>
            )}
          </div>
        </div>
      )}

      {/* Poster Confirmation Bottom Sheet */}
      {showPosterConfirm && (
        <div className="fixed inset-0 z-[105] flex items-end justify-center md:hidden" onClick={() => setShowPosterConfirm(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg rounded-t-2xl border border-white/10 shadow-2xl p-6 bg-[#131313]" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
            <h3 className="font-bold text-white text-base mb-1">Change TV Show Poster</h3>
            <p className="text-white/50 text-xs mb-4">Select an alternate poster for this show</p>
            <button
              onClick={() => { setShowPosterConfirm(false); setShowPosterPicker(true); }}
              className="w-full py-3.5 rounded-full bg-purple-600 text-white font-bold text-sm active:scale-95 transition-transform cursor-pointer flex items-center justify-center gap-2 mb-2"
            >
              <span className="material-symbols-outlined text-[18px]">photo_library</span> Browse Poster Options
            </button>
            <button onClick={() => setShowPosterConfirm(false)} className="w-full py-3 rounded-full border border-white/10 text-white/60 text-sm active:scale-95 transition-transform cursor-pointer">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Poster Picker Modal */}
      {showPosterPicker && user?.id && (
        <PosterPickerModal
          movieId={tvId}
          movieTitle={tvShow.name || ""}
          currentPosterPath={preferredPoster}
          defaultPosterPath={tvShow.poster_path ?? null}
          userId={user.id}
          contentType="tv"
          onClose={() => setShowPosterPicker(false)}
          onSelect={handlePosterSelect}
        />
      )}

      {/* Add To List Modal */}
      {showAddToListModal && user?.id && (
        <AddToListModal
          isOpen={showAddToListModal}
          onClose={() => setShowAddToListModal(false)}
          movieId={tvId}
          movieTitle={tvShow.name || "Unknown Show"}
          posterPath={preferredPoster || tvShow.poster_path || ""}
          contentType="tv"
          userId={user.id}
        />
      )}

      {/* Watched Date Picker Modal */}
      {showWatchedDatePicker && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowWatchedDatePicker(false)}>
          <div className="glass-panel w-full max-w-sm rounded-2xl border border-white/10 p-6 space-y-4 shadow-2xl animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-lg">calendar_month</span>
                <h3 className="font-serif text-base font-bold text-on-surface">Set Watched Date</h3>
              </div>
              <button onClick={() => setShowWatchedDatePicker(false)} className="text-on-surface-variant hover:text-white transition-colors cursor-pointer bg-transparent border-none">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div>
              <label className="text-xs text-on-surface-variant uppercase tracking-widest font-semibold block mb-2">When did you watch this?</label>
              <input
                type="date"
                value={watchedDate}
                onChange={(e) => setWatchedDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-on-surface text-sm focus:outline-none focus:border-purple-400/50 transition-all [color-scheme:dark]"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleWatchedToggle(watchedDate)}
                disabled={watchedLoading}
                className="flex-1 py-2.5 rounded-full bg-secondary text-black font-bold text-xs hover:brightness-110 active:scale-95 transition-all shadow-md cursor-pointer border-none flex items-center justify-center gap-1.5"
              >
                {watchedLoading ? <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"></div> : <><span className="material-symbols-outlined text-sm">save</span>Save Date</>}
              </button>
              <button onClick={() => setShowWatchedDatePicker(false)} className="px-4 py-2.5 rounded-full border border-white/10 text-on-surface-variant text-xs hover:text-white transition-colors cursor-pointer bg-transparent">
                Cancel
              </button>
            </div>
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
