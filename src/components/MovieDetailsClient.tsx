"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { supabase } from "@/lib/supabase";
import NotificationBell from "@/components/NotificationBell";
import ReviewCard from "@/components/ReviewCard";
import Carousel from "@/components/Carousel";
import PosterPickerModal from "@/components/PosterPickerModal";
import AddToListModal from "@/components/AddToListModal";
import { useAuthPrompt } from "@/components/AuthPromptProvider";
import { getAvatarUrlOrDefault } from "@/lib/avatar";
import { getMovieUrl } from "@/lib/slug";

const GENRE_MAP: { [key: number]: string } = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

function formatRuntime(minutes: number) {
  if (!minutes) return "N/A";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}min`;
}

export const DetailsSkeleton = () => (
  <div className="bg-[#050505] text-[#e5e2e1] min-h-screen relative pb-32">
    {/* Top Header Placeholder */}
    <div className="fixed top-0 left-0 w-full z-50 bg-[#131313]/60 backdrop-blur-[40px] border-b border-white/10 flex justify-between items-center px-6 py-4">
      <div className="h-6 w-24 bg-white/10 rounded-full animate-skeleton-pulse"></div>
      <div className="h-6 w-32 bg-white/10 rounded-full animate-skeleton-pulse"></div>
      <div className="h-8 w-8 bg-white/10 rounded-full animate-skeleton-pulse"></div>
    </div>

    {/* Hero Backdrop Skeleton */}
    <div className="h-[450px] md:h-[550px] w-full bg-gradient-to-b from-white/10 via-white/5 to-[#050505] relative animate-skeleton-pulse">
      <div className="absolute inset-0 hero-gradient"></div>
    </div>

    {/* Details Content Skeleton */}
    <div className="px-container-margin -mt-36 md:-mt-44 relative z-10 max-w-screen-xl mx-auto w-full">
      <div className="flex flex-col md:flex-row gap-6 md:gap-10">
        {/* Poster Skeleton */}
        <div className="w-40 md:w-64 aspect-[2/3] rounded-2xl bg-white/10 border border-white/10 shadow-2xl flex-shrink-0 animate-skeleton-pulse mx-auto md:mx-0"></div>

        {/* Details Text Skeleton */}
        <div className="flex-grow pt-4 md:pt-16 space-y-4 text-center md:text-left">
          {/* Tagline / Genre */}
          <div className="h-4 bg-white/10 rounded-md w-1/3 mx-auto md:mx-0 animate-skeleton-pulse"></div>
          {/* Title */}
          <div className="h-10 md:h-14 bg-white/15 rounded-xl w-3/4 mx-auto md:mx-0 animate-skeleton-pulse"></div>
          {/* Meta Info (Rating / Year / Runtime) */}
          <div className="flex items-center justify-center md:justify-start gap-4">
            <div className="h-8 bg-white/10 rounded-full w-24 animate-skeleton-pulse"></div>
            <div className="h-6 bg-white/10 rounded-md w-16 animate-skeleton-pulse"></div>
            <div className="h-6 bg-white/10 rounded-md w-20 animate-skeleton-pulse"></div>
          </div>
          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
            <div className="h-11 bg-white/15 rounded-full w-36 animate-skeleton-pulse"></div>
            <div className="h-11 bg-white/15 rounded-full w-32 animate-skeleton-pulse"></div>
            <div className="h-11 bg-white/15 rounded-full w-28 animate-skeleton-pulse"></div>
          </div>
        </div>
      </div>

      {/* Synopsis Skeleton */}
      <div className="mt-12 max-w-3xl space-y-3">
        <div className="h-6 bg-white/15 rounded-md w-32 animate-skeleton-pulse"></div>
        <div className="h-4 bg-white/10 rounded-md w-full animate-skeleton-pulse"></div>
        <div className="h-4 bg-white/10 rounded-md w-11/12 animate-skeleton-pulse"></div>
        <div className="h-4 bg-white/10 rounded-md w-4/5 animate-skeleton-pulse"></div>
      </div>

      {/* Cast Skeleton */}
      <div className="mt-12 space-y-4">
        <div className="h-6 bg-white/15 rounded-md w-28 animate-skeleton-pulse"></div>
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="min-w-[100px] space-y-2 flex-shrink-0">
              <div className="w-20 h-20 rounded-full bg-white/10 animate-skeleton-pulse mx-auto"></div>
              <div className="h-3 bg-white/10 rounded w-full animate-skeleton-pulse"></div>
              <div className="h-3 bg-white/5 rounded w-2/3 animate-skeleton-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default function MovieDetailsClient({ movieId, initialSlug }: { movieId: string; initialSlug?: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user as any;
  const { showAuthPrompt } = useAuthPrompt();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const [scrolled, setScrolled] = useState(false);
  const [movie, setMovie] = useState<any>(null);

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
  const [cast, setCast] = useState<any[]>([]);
  const [directors, setDirectors] = useState<any[]>([]);
  const [similarMovies, setSimilarMovies] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  const [newReviewText, setNewReviewText] = useState("");
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false);
  const [dbReviews, setDbReviews] = useState<any[]>([]);
  const [reviewAvatars, setReviewAvatars] = useState<Record<string, string>>({});
  const [reviewRatings, setReviewRatings] = useState<Record<string, number>>({});
  const [helpfulVotes, setHelpfulVotes] = useState<Record<string, number>>({});
  const [userHelpful, setUserHelpful] = useState<Set<string>>(new Set());
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [isEditingSubmitting, setIsEditingSubmitting] = useState(false);

  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: "", visible: false });

  // Streaming / watch providers
  const [watchProviders, setWatchProviders] = useState<any[]>([]);

  // Custom List & Watched Date states
  const [showAddToListModal, setShowAddToListModal] = useState(false);
  const [showWatchedDatePicker, setShowWatchedDatePicker] = useState(false);
  const [watchedDate, setWatchedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [watchedAtTimestamp, setWatchedAtTimestamp] = useState<string | null>(null);

  // Poster preference
  const [preferredPoster, setPreferredPoster] = useState<string | null>(null);
  const [showPosterPicker, setShowPosterPicker] = useState(false);
  // Mobile bottom-sheet confirmation before opening the full poster picker
  const [showPosterConfirm, setShowPosterConfirm] = useState(false);

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 3000);
  };

  // Canonicalize URL in browser address bar to include slug
  useEffect(() => {
    if (movie?.id && typeof window !== "undefined") {
      const canonicalUrl = getMovieUrl(movie.id, movie.title);
      if (window.location.pathname !== canonicalUrl) {
        window.history.replaceState(null, "", canonicalUrl);
      }
    }
  }, [movie]);

  // Fetch this user's preferred poster for this movie
  useEffect(() => {
    if (!user?.id || !movieId) return;
    const userId = user.id;
    fetch(`/api/poster-preference?userId=${encodeURIComponent(userId)}&movieId=${encodeURIComponent(movieId)}&contentType=movie`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.poster_path) setPreferredPoster(data.poster_path);
      })
      .catch(() => { });
  }, [user, movieId]);

  const handlePosterSelect = useCallback((posterPath: string | null) => {
    setPreferredPoster(posterPath);
    showToast(posterPath ? "Poster updated!" : "Poster reset to default!");
  }, []);

  // Fetch watchlist status
  useEffect(() => {
    if (!user?.id || !movieId) return;
    const userId = user.id;
    async function checkWatchlist() {
      try {
        const { data, error } = await supabase
          .from("watchlist")
          .select("*")
          .eq("user_id", userId)
          .eq("movie_id", movieId)
          .or("content_type.eq.movie,content_type.is.null")
          .maybeSingle();
        setIsInWatchlist(!!data);
      } catch (err) {
        console.error("Error checking watchlist:", err);
      }
    }
    checkWatchlist();
  }, [user, movieId]);

  // Toggle watchlist status
  const handleWatchlistToggle = async () => {
    if (!user?.id || !movie) {
      if (!user?.id) {
        showAuthPrompt({
          title: "Save to Watchlist",
          message: "Sign in to save this film to your watchlist and keep track of movies to watch.",
        });
      }
      return;
    }
    const userId = user.id;
    setWatchlistLoading(true);
    try {
      if (isInWatchlist) {
        const { error } = await supabase
          .from("watchlist")
          .delete()
          .eq("user_id", userId)
          .eq("movie_id", movieId)
          .or("content_type.eq.movie,content_type.is.null");
        if (!error) {
          setIsInWatchlist(false);
          showToast("Removed from watchlist!");
        }
      } else {
        const { error } = await supabase
          .from("watchlist")
          .insert({
            user_id: userId,
            movie_id: movieId,
            movie_title: movie.title || movie.name || "Unknown Movie",
            poster_path: movie.poster_path || "",
            content_type: "movie",
          });
        if (!error) {
          setIsInWatchlist(true);
          showToast("Added to watchlist!");
        }
      }
    } catch (err) {
      console.error("Error toggling watchlist:", err);
    } finally {
      setWatchlistLoading(false);
    }
  };

  // Fetch watched status
  useEffect(() => {
    if (!user?.id || !movieId) return;
    const userId = user.id;
    async function checkWatched() {
      try {
        const res = await fetch(`/api/watched?userId=${userId}&movieId=${movieId}&contentType=movie`);
        if (res.ok) {
          const data = await res.json();
          setIsWatched(!!data);
          if (data?.watched_at) {
            setWatchedAtTimestamp(data.watched_at);
            setWatchedDate(new Date(data.watched_at).toISOString().split("T")[0]);
          }
        }
      } catch (err) {
        console.error("Error checking watched:", err);
      }
    }
    checkWatched();
  }, [user, movieId]);

  // Toggle watched status (or update watched date)
  const handleWatchedToggle = async (customDate?: string) => {
    if (!user?.id || !movie) {
      if (!user?.id) {
        showAuthPrompt({
          title: "Log Film as Watched",
          message: "Sign in to mark films as watched, log dates, and build your viewing history.",
        });
      }
      return;
    }
    const userId = user.id;
    setWatchedLoading(true);
    try {
      if (isWatched && !customDate) {
        const res = await fetch(`/api/watched?userId=${userId}&movieId=${movieId}&contentType=movie`, {
          method: "DELETE"
        });
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
            user_id: userId,
            movie_id: movieId,
            movie_title: movie.title || movie.name || "Unknown Movie",
            poster_path: preferredPoster || movie.poster_path || "",
            content_type: "movie",
            watched_at: targetDate ? new Date(targetDate).toISOString() : undefined,
          })
        });
        if (res.ok) {
          setIsWatched(true);
          const savedTimestamp = targetDate ? new Date(targetDate).toISOString() : new Date().toISOString();
          setWatchedAtTimestamp(savedTimestamp);
          setWatchedDate(savedTimestamp.split("T")[0]);
          // If in watchlist, remove from watchlist
          if (isInWatchlist) {
            await supabase
              .from("watchlist")
              .delete()
              .eq("user_id", userId)
              .eq("movie_id", movieId)
              .or("content_type.eq.movie,content_type.is.null");
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

  // Fetch user rating & liked
  useEffect(() => {
    if (!user?.id || !movieId) return;
    const userId = user.id;
    async function fetchUserRating() {
      try {
        const { data, error } = await supabase
          .from("ratings")
          .select("rating, liked")
          .eq("user_id", userId)
          .eq("movie_id", movieId)
          .or("content_type.eq.movie,content_type.is.null")
          .maybeSingle();
        if (data) {
          setUserRating(data.rating !== null && data.rating !== undefined ? Number(data.rating) : null);
          setUserLiked(!!data.liked);
        } else {
          setUserRating(null);
          setUserLiked(false);
        }
      } catch (err) {
        console.error("Error fetching user rating:", err);
      }
    }
    fetchUserRating();
  }, [user, movieId]);

  // Submit rating
  const handleRatingSubmit = async (ratingVal: number) => {
    if (!user?.id || !movieId) return;
    const userId = user.id;
    setIsRatingSubmitting(true);
    try {
      const ratingPayload: any = {
        user_id: userId,
        movie_id: movieId,
        rating: ratingVal,
        liked: modalLiked,
        created_at: new Date().toISOString(),
        content_type: "movie",
      };

      const { error } = await supabase
        .from("ratings")
        .upsert(ratingPayload, { onConflict: "user_id,movie_id,content_type" });

      if (!error) {
        setUserRating(ratingVal);
        setUserLiked(modalLiked);
        setShowRatingModal(false);

        // Automatically mark as watched if not already watched
        if (!isWatched) {
          await fetch("/api/watched", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: userId,
              movie_id: movieId,
              movie_title: movie?.title || movie?.name || "Unknown Movie",
              poster_path: movie?.poster_path || "",
              content_type: "movie"
            })
          });
          setIsWatched(true);
        }

        // Remove from watchlist if present
        if (isInWatchlist) {
          await supabase
            .from("watchlist")
            .delete()
            .eq("user_id", userId)
            .eq("movie_id", movieId)
            .or("content_type.eq.movie,content_type.is.null");
          setIsInWatchlist(false);
        }

        showToast("Rating updated!");
      } else {
        showToast("Failed to save rating");
      }
    } catch (err) {
      console.error("Error submitting rating:", err);
    } finally {
      setIsRatingSubmitting(false);
    }
  };

  // Delete rating
  const handleRatingDelete = async () => {
    if (!user?.id || !movieId) return;
    setIsRatingSubmitting(true);
    try {
      const { error } = await supabase
        .from("ratings")
        .delete()
        .eq("user_id", user.id)
        .eq("movie_id", movieId)
        .or("content_type.eq.movie,content_type.is.null");

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

  // Fetch reviews from database
  useEffect(() => {
    if (!movieId) return;
    async function fetchDbReviews() {
      try {
        const { data, error } = await supabase
          .from("reviews")
          .select("*")
          .eq("movie_id", movieId)
          .order("created_at", { ascending: false });
        if (data && data.length > 0) {
          setDbReviews(data);

          const userIds = Array.from(new Set(data.map((r: any) => r.user_id)));

          const [profilesRes, ratingsRes] = await Promise.all([
            supabase.from("profiles").select("user_id, avatar_url").in("user_id", userIds),
            supabase.from("ratings").select("user_id, rating").eq("movie_id", movieId).in("user_id", userIds)
          ]);

          const avatarsMap: Record<string, string> = {};
          if (profilesRes.data) {
            profilesRes.data.forEach((p: any) => {
              if (p.avatar_url) avatarsMap[p.user_id] = p.avatar_url;
            });
          }
          setReviewAvatars(avatarsMap);

          const ratingsMap: Record<string, number> = {};
          if (ratingsRes.data) {
            ratingsRes.data.forEach((r: any) => {
              ratingsMap[r.user_id] = r.rating;
            });
          }
          setReviewRatings(ratingsMap);
        } else {
          setDbReviews([]);
        }
      } catch (err) {
        console.error("Error fetching reviews:", err);
      }
    }
    fetchDbReviews();
  }, [movieId]);

  const toggleHelpful = (reviewId: string) => {
    setUserHelpful(prev => {
      const next = new Set(prev);
      const currentCount = helpfulVotes[reviewId] || 0;
      const isAdding = !next.has(reviewId);

      if (!isAdding) {
        next.delete(reviewId);
        setHelpfulVotes(hp => ({ ...hp, [reviewId]: Math.max(0, currentCount - 1) }));
      } else {
        next.add(reviewId);
        setHelpfulVotes(hp => ({ ...hp, [reviewId]: currentCount + 1 }));

        // Fire review_like notification to review author
        const rev = dbReviews.find(r => r.id === reviewId);
        if (rev && user?.id && rev.user_id !== user.id) {
          const movieTitle = movie?.title || "a movie";
          const actorName = user.name || "Someone";
          fetch("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: rev.user_id,
              actor_id: user.id,
              actor_name: actorName,
              actor_avatar: user.image || null,
              type: "review_like",
              message: `${actorName} found your review of "${movieTitle}" helpful`,
              link: getMovieUrl(movieId, movieTitle),
            }),
          }).catch(() => { });
        }
      }
      return next;
    });
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm("Are you sure you want to delete your review?")) return;
    try {
      const { error } = await supabase.from("reviews").delete().eq("id", reviewId);
      if (!error) {
        setDbReviews(prev => prev.filter(r => r.id !== reviewId));
        showToast("Review deleted");
      }
    } catch (e) {
      console.error("Error deleting review:", e);
    }
  };

  const handleStartEdit = (rev: any) => {
    setEditingReviewId(rev.id);
    setEditText(rev.review_text);
  };

  const handleSaveEdit = async (reviewId: string) => {
    if (!editText.trim()) return;
    setIsEditingSubmitting(true);
    try {
      const { error } = await supabase
        .from("reviews")
        .update({ review_text: editText.trim() })
        .eq("id", reviewId);
      if (!error) {
        setDbReviews(prev => prev.map(r => r.id === reviewId ? { ...r, review_text: editText.trim() } : r));
        setEditingReviewId(null);
        showToast("Review updated!");
      }
    } catch (e) {
      console.error("Error updating review:", e);
    } finally {
      setIsEditingSubmitting(false);
    }
  };

  // Submit review
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      showAuthPrompt({
        title: "Leave a Review",
        message: "Sign in to write and share your review with the CineSocial community.",
      });
      return;
    }
    if (!movieId || !newReviewText.trim()) return;
    const userId = user.id;
    const userName = user.name || "Cine Member";
    setIsReviewSubmitting(true);
    try {
      const newReview = {
        user_id: userId,
        user_name: userName,
        movie_id: movieId,
        review_text: newReviewText.trim(),
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("reviews")
        .insert(newReview)
        .select()
        .single();

      if (!error && data) {
        setDbReviews([data, ...dbReviews]);
        setNewReviewText("");
        showToast("Review posted successfully!");
      } else if (!error) {
        setDbReviews([newReview, ...dbReviews]);
        setNewReviewText("");
        showToast("Review posted successfully!");
      }
    } catch (err) {
      console.error("Error submitting review:", err);
    } finally {
      setIsReviewSubmitting(false);
    }
  };

  useEffect(() => {
    async function fetchMovieDetails() {
      setLoading(true);
      setError(null);
      try {
        const [movieRes, creditsRes, similarRes, reviewsRes, videosRes, providersRes] = await Promise.all([
          fetch(`/api/tmdb?endpoint=movie/${movieId}`),
          fetch(`/api/tmdb?endpoint=movie/${movieId}/credits`),
          fetch(`/api/tmdb?endpoint=movie/${movieId}/similar`),
          fetch(`/api/tmdb?endpoint=movie/${movieId}/reviews`),
          fetch(`/api/tmdb?endpoint=movie/${movieId}/videos`),
          fetch(`/api/tmdb?endpoint=movie/${movieId}/watch/providers`)
        ]);

        if (!movieRes.ok) {
          throw new Error(`Failed to fetch movie details (status ${movieRes.status})`);
        }

        const movieData = await movieRes.json();
        const creditsData = await creditsRes.json();
        const similarData = await similarRes.json();
        const reviewsData = await reviewsRes.json();
        const videosData = await videosRes.json();
        const providersData = providersRes.ok ? await providersRes.json() : null;

        setMovie(movieData);
        if (creditsData.cast) {
          setCast(creditsData.cast.slice(0, 10));
        }
        if (creditsData.crew) {
          const dirs = creditsData.crew.filter((c: any) => c.job === "Director");
          setDirectors(dirs);
        }
        if (similarData.results) {
          setSimilarMovies(similarData.results.slice(0, 5));
        }
        if (videosData.results) {
          const trailer = videosData.results.find((v: any) => v.site === "YouTube" && v.type === "Trailer");
          if (trailer) {
            setTrailerKey(trailer.key);
          } else {
            const anyVideo = videosData.results.find((v: any) => v.site === "YouTube");
            if (anyVideo) setTrailerKey(anyVideo.key);
          }
        }

        if (providersData?.results) {
          const regionData = providersData.results["IN"] || providersData.results["US"];
          const providers: any[] = [];
          if (regionData?.flatrate) providers.push(...regionData.flatrate.map((p: any) => ({ ...p, type: "Stream" })));
          if (regionData?.rent) providers.push(...regionData.rent.map((p: any) => ({ ...p, type: "Rent" })));
          if (regionData?.buy) providers.push(...regionData.buy.map((p: any) => ({ ...p, type: "Buy" })));
          const seen = new Set<number>();
          setWatchProviders(providers.filter(p => { if (seen.has(p.provider_id)) return false; seen.add(p.provider_id); return true; }));
        }

        if (reviewsData.results && reviewsData.results.length > 0) {
          setReviews(reviewsData.results.slice(0, 2));
        } else {
          setReviews([]);
        }
      } catch (err: any) {
        console.error("Error loading movie details:", err);
        setError(err.message || "Failed to load movie details.");
      } finally {
        setLoading(false);
      }
    }

    fetchMovieDetails();
  }, [movieId]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty("--mouse-x", `${x}px`);
    card.style.setProperty("--mouse-y", `${y}px`);
  };

  if (loading) {
    return <DetailsSkeleton />;
  }

  if (error || !movie) {
    return (
      <div className="bg-[#050505] text-[#e5e2e1] min-h-screen flex flex-col items-center justify-center p-container-margin gap-4">
        <span className="material-symbols-outlined text-[48px] text-primary">error</span>
        <h2 className="font-display-lg text-headline-lg font-serif">Oops! Something went wrong</h2>
        <p className="text-on-surface-variant text-center max-w-md">{error || "Movie details could not be found."}</p>
        <Link href="/" className="bg-primary-container text-on-primary-container px-6 py-3 rounded-full font-semibold hover:opacity-90 transition-opacity">
          Back to Home
        </Link>
      </div>
    );
  }

  const ratingValue = movie.vote_average ? movie.vote_average.toFixed(1) : "N/A";
  const formattedRuntime = formatRuntime(movie.runtime);
  const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : "";

  return (
    <div className="bg-[#050505] text-[#e5e2e1] font-body-md overflow-x-clip min-h-screen relative pb-32">
      {/* Top Navigation Bar */}
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
          className="flex items-center gap-stack-sm hover:opacity-80 transition-opacity cursor-pointer text-primary drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)] bg-transparent border-none p-0"
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
              onClick={() => {
                if (!user) {
                  showAuthPrompt({
                    title: "Sign in to Cine Social",
                    message: "Sign in to access your profile, watchlists, ratings, and custom lists.",
                  });
                } else {
                  setShowProfileMenu(!showProfileMenu);
                }
              }}
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

            {showProfileMenu && user && (
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

      {/* Main Content Canvas */}
      <main className="relative pt-[60px]">
        {/* Cinematic Backdrop */}
        <section className="relative h-[574px] w-full overflow-hidden">
          <img
            className="w-full h-full object-cover scale-105 transition-transform duration-100 animate-fade-in"
            alt={movie.title || "Movie Backdrop"}
            src={movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1600"}
          />
          <div className="absolute inset-0 hero-gradient"></div>
        </section>

        {/* Floating Poster & Main Info Section */}
        <div className="px-container-margin -mt-40 relative z-10 max-w-screen-xl mx-auto w-full">
          <div className="flex flex-col md:flex-row gap-gutter">
            {/* Movie Poster */}
            <div className="w-40 md:w-64 flex-shrink-0 group/poster relative">
              <div className="rounded-xl overflow-hidden shadow-2xl border border-white/10 aspect-[2/3] relative">
                <img
                  className="w-full h-full object-cover transition-transform duration-700 group-hover/poster:scale-110"
                  alt={movie.title || "Movie Poster"}
                  src={(preferredPoster ?? movie.poster_path) ? `https://image.tmdb.org/t/p/w500${preferredPoster ?? movie.poster_path}` : "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500"}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>

                {/* Change Poster button */}
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
                      className="md:hidden absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-white text-[11px] font-bold shadow-lg active:scale-95 transition-transform cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[13px]">edit</span>
                      Edit Poster
                    </button>
                  </>
                )}
              </div>
              {/* Preferred poster indicator */}
              {preferredPoster && preferredPoster !== movie.poster_path && (
                <div className="flex items-center gap-1 mt-1.5 justify-center">
                  <span className="material-symbols-outlined text-[12px] text-[#ffb4aa]">auto_awesome</span>
                  <span className="text-[10px] text-[#ffb4aa] font-bold uppercase tracking-widest">Custom</span>
                </div>
              )}
            </div>

            {/* Info Section */}
            <div className="flex-grow pt-10 md:pt-20">
              <h2 className="font-headline-lg text-headline-lg text-on-surface mb-2 tracking-tight font-serif">
                {movie.title || movie.name}
              </h2>
              <div className="flex flex-wrap items-center gap-stack-md mb-stack-lg">
                <div className="flex items-center gap-1 text-secondary">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                    star
                  </span>
                  <span className="font-bold text-title-lg">{ratingValue}</span>
                  <span className="text-on-surface-variant text-body-md opacity-60">/10</span>
                </div>
                <div className="h-4 w-px bg-white/20"></div>
                <span className="text-on-surface-variant font-body-md">{formattedRuntime}</span>
                <div className="h-4 w-px bg-white/20"></div>
                <span className="text-on-surface-variant font-body-md">{releaseYear}</span>
                <div className="h-4 w-px bg-white/20"></div>
                <div className="flex flex-wrap gap-2">
                  {movie.genres && movie.genres.map((g: any) => (
                    <span key={g.id} className="px-3 py-1 glass-card rounded-full text-label-sm text-primary uppercase">
                      {g.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Director Info */}
              {directors.length > 0 && (
                <div className="flex items-center gap-2 mb-stack-lg flex-wrap text-body-md">
                  <span className="text-on-surface-variant opacity-70">Directed by</span>
                  {directors.map((dir: any, idx: number) => (
                    <React.Fragment key={dir.id}>
                      {idx > 0 && <span className="text-on-surface-variant opacity-40">,</span>}
                      <Link
                        href={`/person/${dir.id}`}
                        className="text-primary font-semibold hover:underline cursor-pointer inline-flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 px-3.5 py-1 rounded-full border border-primary/30 transition-all text-xs"
                      >
                        <span className="material-symbols-outlined text-xs">movie_filter</span>
                        {dir.name}
                      </Link>
                    </React.Fragment>
                  ))}
                </div>
              )}

              {/* Watch Providers */}
              {watchProviders.length > 0 && (
                <div className="flex items-center gap-2 mb-5 flex-wrap text-body-md">
                  <span className="text-on-surface-variant opacity-70">Streaming on</span>
                  {watchProviders.map((p: any) => (
                    <span
                      key={p.provider_id}
                      title={`${p.provider_name} — ${p.type}`}
                      className="flex items-center gap-1.5 text-xs text-on-surface-variant border border-white/10 bg-white/5 hover:bg-white/10 transition-colors px-2.5 py-1 rounded-full"
                    >
                      {p.logo_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w45${p.logo_path}`}
                          alt={p.provider_name}
                          className="w-4 h-4 rounded-sm object-cover"
                        />
                      ) : (
                        <span className="material-symbols-outlined text-[14px]">play_circle</span>
                      )}
                      {p.provider_name}
                    </span>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-stack-md">
                <button
                  onClick={handleWatchlistToggle}
                  disabled={watchlistLoading}
                  className={`px-6 py-3 rounded-full font-title-lg flex items-center gap-2 active:scale-95 transition-all duration-200 cursor-pointer border-none ${isInWatchlist
                    ? "bg-primary text-black shadow-[0_0_20px_rgba(255,180,170,0.35)]"
                    : "bg-primary-container text-on-primary-container"
                    }`}
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: isInWatchlist ? "'FILL' 1" : "" }}>
                    {isInWatchlist ? "bookmark_added" : "bookmark_add"}
                  </span>
                  {isInWatchlist ? "In Watchlist" : "Add to Watchlist"}
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleWatchedToggle()}
                    disabled={watchedLoading}
                    className={`px-6 py-3 rounded-full font-title-lg flex items-center gap-2 active:scale-95 transition-all duration-200 cursor-pointer border-none ${isWatched
                      ? "bg-secondary text-black shadow-[0_0_20px_rgba(233,195,73,0.35)]"
                      : "bg-primary-container text-on-primary-container"
                      }`}
                  >
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: isWatched ? "'FILL' 1" : "" }}>
                      {isWatched ? "visibility" : "visibility_off"}
                    </span>
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
                      showAuthPrompt({
                        title: "Add to List",
                        message: "Sign in to create, organize, and add movies to your custom lists.",
                      });
                      return;
                    }
                    setShowAddToListModal(true);
                  }}
                  className="px-6 py-3 rounded-full font-title-lg flex items-center gap-2 active:scale-95 transition-all duration-200 glass-card cursor-pointer border border-white/10 text-on-surface hover:border-primary/40 hover:text-primary"
                >
                  <span className="material-symbols-outlined">playlist_add</span>
                  Add to List
                </button>

                {trailerKey && (
                  <button
                    onClick={() => setShowTrailerModal(true)}
                    className="px-6 py-3 rounded-full font-title-lg flex items-center gap-2 active:scale-95 transition-all duration-200 bg-[#e5e2e1] text-black hover:bg-white transition-colors cursor-pointer border-none"
                  >
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                      play_circle
                    </span>
                    Watch Trailer
                  </button>
                )}
                <button
                  onClick={() => {
                    if (!user?.id) {
                      showAuthPrompt({
                        title: "Rate this Film",
                        message: "Sign in to rate films, give thumbs up/down, and log your score.",
                      });
                      return;
                    }
                    setHoverRating(userRating || 5);
                    setModalLiked(userLiked);
                    setShowRatingModal(true);
                  }}
                  className={`px-6 py-3 rounded-full font-title-lg flex items-center gap-2 active:scale-95 transition-all duration-200 glass-card cursor-pointer border ${userRating
                    ? "border-primary text-primary shadow-[0_0_15px_rgba(255,180,170,0.15)]"
                    : "border-secondary text-secondary"
                    }`}
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                    grade
                  </span>
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
                        title: movie.title || "Movie",
                        text: `Check out ${movie.title} on CineSocial`,
                        url: window.location.href,
                      }).catch(() => {});
                    } else if (navigator.clipboard) {
                      navigator.clipboard.writeText(window.location.href);
                      showToast("Link copied to clipboard!");
                    }
                  }}
                  className="glass-card text-on-surface p-3 rounded-full active:scale-90 transition-transform cursor-pointer"
                  title="Share movie"
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
                    className="text-primary hover:underline ml-1 cursor-pointer bg-transparent border-none p-0 text-xs font-semibold"
                  >
                    Edit date
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Plot Summary */}
          <section className="mt-stack-xl max-w-3xl">
            <h3 className="font-title-lg text-title-lg text-primary mb-stack-sm uppercase tracking-widest font-serif">
              The Synopsis
            </h3>
            <p className="text-on-surface-variant text-body-lg leading-relaxed opacity-90">
              {movie.overview || "No plot summary available for this movie."}
            </p>
          </section>

          {/* Cast Carousel */}
          {cast.length > 0 && (
            <section className="mt-stack-xl">
              <div className="flex justify-between items-end mb-stack-lg">
                <h3 className="font-title-lg text-title-lg text-primary uppercase tracking-widest font-serif">
                  Ensemble Cast
                </h3>
              </div>
              <Carousel containerClassName="gap-stack-lg pb-4">
                {cast.map((actor: any) => (
                  <Link
                    key={actor.id}
                    href={`/person/${actor.id}`}
                    className="flex-shrink-0 w-24 text-center group/card cursor-pointer block"
                  >
                    <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-transparent group-hover/card:border-primary transition-all mb-2 shadow-lg bg-white/5">
                      <img
                        className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300"
                        alt={actor.name}
                        src={actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}
                        draggable={false}
                      />
                    </div>
                    <span className="block text-body-md text-on-surface font-semibold truncate group-hover/card:text-primary transition-colors">{actor.name}</span>
                    <span className="block text-label-sm text-on-surface-variant opacity-60 truncate">{actor.character}</span>
                  </Link>
                ))}
              </Carousel>
            </section>
          )}

          {/* Review Section */}
          <section className="mt-stack-xl">
            <h3 className="font-title-lg text-title-lg text-primary mb-stack-lg uppercase tracking-widest font-serif">
              Community Pulse
            </h3>

            {/* Write a Review Form */}
            <div className="glass-card p-6 rounded-xl border border-white/10 mb-8 max-w-3xl">
              <h4 className="font-title-lg text-title-lg text-primary mb-3 font-serif uppercase tracking-widest">
                Leave a Review
              </h4>
              <form onSubmit={handleReviewSubmit} className="space-y-4">
                <textarea
                  value={newReviewText}
                  onChange={(e) => setNewReviewText(e.target.value)}
                  placeholder="Share your thoughts about this masterpiece..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-body-md"
                  required
                />
                <div className="flex justify-between items-center">
                  <span className="text-label-sm text-on-surface-variant opacity-55">
                    Logged in as {user?.name || "Cine Member"}
                  </span>
                  <button
                    type="submit"
                    disabled={isReviewSubmitting || !newReviewText.trim()}
                    className="bg-primary text-black px-6 py-2.5 rounded-full font-semibold flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 cursor-pointer text-body-md"
                  >
                    {isReviewSubmitting ? (
                      <div className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <span className="material-symbols-outlined text-sm">send</span>
                    )}
                    Post Review
                  </button>
                </div>
              </form>
            </div>

            {dbReviews.length > 0 || reviews.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-lg">
                {/* Database Reviews */}
                {dbReviews.map((rev: any) => {
                  const avatar = reviewAvatars[rev.user_id];
                  const rating = reviewRatings[rev.user_id];
                  const isEditing = editingReviewId === rev.id;

                  return (
                    <ReviewCard
                      key={rev.id || rev.created_at}
                      review={rev}
                      currentUserId={user?.id}
                      currentUserName={user?.name}
                      currentUserAvatar={user?.image}
                      avatarUrl={avatar}
                      userRating={rating}
                      movieTitle={movie?.title || movie?.name}
                      onEdit={handleStartEdit}
                      onDelete={handleDeleteReview}
                      isEditing={isEditing}
                      editText={editText}
                      setEditText={setEditText}
                      onSaveEdit={handleSaveEdit}
                      onCancelEdit={() => setEditingReviewId(null)}
                      isEditingSubmitting={isEditingSubmitting}
                    />
                  );
                })}

                {/* TMDB Reviews */}
                {reviews.map((rev: any) => (
                  <div
                    key={rev.id}
                    className="glass-card p-6 rounded-xl relative overflow-hidden group"
                    onMouseMove={handleMouseMove}
                  >
                    <div className="absolute top-0 right-0 p-3">
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded uppercase font-bold tracking-tighter">
                        No Spoilers
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-secondary-container/30 flex items-center justify-center text-secondary font-bold text-sm uppercase">
                        {rev.author ? rev.author.slice(0, 2) : "UR"}
                      </div>
                      <div>
                        <h4 className="font-body-lg font-bold text-on-surface">{rev.author}</h4>
                        {rev.author_details?.rating && (
                          <div className="flex text-secondary scale-75 -ml-4">
                            {Array.from({ length: Math.min(5, Math.ceil(rev.author_details.rating / 2)) }).map((_, i) => (
                              <span key={i} className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                                star
                              </span>
                            ))}
                            {Array.from({ length: 5 - Math.min(5, Math.ceil(rev.author_details.rating / 2)) }).map((_, i) => (
                              <span key={i} className="material-symbols-outlined">
                                star
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-on-surface-variant text-body-md line-clamp-4 overflow-y-auto max-h-24 hide-scrollbar">
                      {rev.content}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-card p-8 rounded-xl border border-white/10 text-center max-w-3xl">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-2 block">
                  rate_review
                </span>
                <p className="text-on-surface-variant opacity-80 text-body-md font-medium">
                  No reviews yet — be the first to review this film!
                </p>
              </div>
            )}
          </section>

          {/* Similar Movies Grid */}
          {similarMovies.length > 0 && (
            <section className="mt-stack-xl">
              <h3 className="font-title-lg text-title-lg text-primary mb-stack-lg uppercase tracking-widest font-serif">
                Recommended Features
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-stack-md">
                {similarMovies.map((sim: any) => {
                  const simRating = sim.vote_average ? sim.vote_average.toFixed(1) : "N/A";
                  const simGenres = sim.genre_ids ? sim.genre_ids.slice(0, 2).map((id: number) => GENRE_MAP[id]).filter(Boolean).join(", ") : "";

                  return (
                    <Link key={sim.id} href={getMovieUrl(sim.id, sim.title)} className="group cursor-pointer block">
                      <div className="aspect-[2/3] rounded-lg overflow-hidden border border-white/5 relative mb-2 bg-white/5">
                        <img
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          alt={sim.title}
                          src={sim.poster_path ? `https://image.tmdb.org/t/p/w342${sim.poster_path}` : "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=342"}
                        />
                        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black to-transparent"></div>
                        <div className="absolute bottom-2 left-2 flex items-center gap-1 text-secondary text-[10px]">
                          <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            star
                          </span>
                          {simRating}
                        </div>
                      </div>
                      <span className="block text-body-md font-bold truncate">{sim.title}</span>
                      <span className="block text-label-sm text-on-surface-variant opacity-60 truncate">{simGenres}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-[60px] z-50 mb-container-margin mx-container-margin rounded-full bg-surface/40 backdrop-blur-[100px] border border-white/10 flex justify-around items-center px-6 shadow-[0_0_20px_rgba(255,180,170,0.1)] max-w-md md:left-1/2 md:-translate-x-1/2">
        <Link
          className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90"
          href="/"
        >
          <span className="material-symbols-outlined">home</span>
        </Link>
        <Link
          className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90"
          href="/recommendations"
        >
          <span className="material-symbols-outlined">search</span>
        </Link>
        <Link
          className="flex items-center justify-center text-primary relative after:content-[''] after:absolute after:-bottom-2 after:w-1 after:h-1 after:bg-primary after:rounded-full after:shadow-[0_0_8px_#ffb4aa] active:scale-90"
          href="/movies"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            bookmark
          </span>
        </Link>
        <Link
          className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90"
          href="/community"
        >
          <span className="material-symbols-outlined">group</span>
        </Link>
        <Link
          className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90"
          href="/profile"
        >
          <span className="material-symbols-outlined">person</span>
        </Link>
      </nav>

      {/* Interactive Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in text-[#e5e2e1]">
          <div className="glass-panel max-w-sm w-full p-8 rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-center relative">
            <button
              onClick={() => setShowRatingModal(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface cursor-pointer border-none bg-transparent"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <h3 className="font-serif text-[28px] text-primary mb-2">Rate {movie.title || movie.name}</h3>
            <p className="text-on-surface-variant text-body-md mb-6">
              How would you describe your narrative experience?
            </p>

            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-secondary to-primary-container text-on-primary-container font-serif text-[28px] flex items-center justify-center shadow-[0_0_20px_rgba(255,180,170,0.3)] animate-pulse mb-2">
                {((hoverRating || userRating || 5) % 1 === 0 ? (hoverRating || userRating || 5) : (hoverRating || userRating || 5).toFixed(1))}
              </div>

              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={hoverRating || userRating || 5}
                onChange={(e) => setHoverRating(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
              />

              <div className="flex justify-between w-full text-[10px] text-on-surface-variant uppercase tracking-widest px-1 font-bold opacity-60">
                <span>1 - Awful</span>
                <span>5 - Good</span>
                <span>10 - Masterpiece</span>
              </div>
            </div>

            {/* Liked Toggle Button */}
            <div className="mb-6 flex justify-center">
              <button
                type="button"
                onClick={() => setModalLiked(!modalLiked)}
                className={`flex items-center justify-center gap-2 py-2 px-5 rounded-full border transition-all cursor-pointer ${
                  modalLiked
                    ? "bg-red-500/20 text-red-400 border-red-500/40 shadow-lg shadow-red-500/10 scale-105"
                    : "bg-white/5 text-on-surface-variant hover:text-white border-white/10"
                }`}
              >
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={{ fontVariationSettings: modalLiked ? "'FILL' 1" : "" }}
                >
                  favorite
                </span>
                <span className="text-xs font-semibold">{modalLiked ? "Liked this movie" : "Like this movie"}</span>
              </button>
            </div>

            <button
              onClick={() => handleRatingSubmit(hoverRating || userRating || 5)}
              disabled={isRatingSubmitting}
              className="w-full bg-white text-black py-3 rounded-full font-bold shadow-lg hover:shadow-white/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 text-body-lg"
            >
              {isRatingSubmitting && (
                <div className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              )}
              {userRating !== null ? "Update Rating" : "Confirm Rating"}
            </button>

            {userRating !== null && (
              <button
                type="button"
                onClick={handleRatingDelete}
                disabled={isRatingSubmitting}
                className="w-full mt-2.5 py-2.5 rounded-full border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                Remove My Rating
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mobile Poster Confirm Bottom Sheet */}
      {showPosterConfirm && (
        <div
          className="fixed inset-0 z-[105] flex items-end justify-center md:hidden"
          onClick={() => setShowPosterConfirm(false)}
        >
          {/* Dim backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Sheet */}
          <div
            className="relative w-full max-w-lg rounded-t-2xl border border-white/10 shadow-2xl overflow-hidden animate-fade-in"
            style={{ background: "linear-gradient(180deg, #1a1a1a 0%, #131313 100%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            <div className="px-6 py-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-[#ffb4aa] text-xl">collections</span>
                </div>
                <div>
                  <h3 className="font-bold text-white text-base leading-tight">Change Movie Poster</h3>
                  <p className="text-white/50 text-xs mt-0.5">Pick a different artwork for this film</p>
                </div>
              </div>

              {/* Current poster preview */}
              <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3 mb-4 border border-white/10">
                <img
                  src={(preferredPoster ?? movie?.poster_path) ? `https://image.tmdb.org/t/p/w92${preferredPoster ?? movie?.poster_path}` : "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=92"}
                  alt="Current poster"
                  className="w-12 rounded-lg object-cover aspect-[2/3] flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-white/40 text-[10px] uppercase tracking-widest mb-0.5">Current poster</p>
                  <p className="text-white text-sm font-semibold truncate">{movie?.title || movie?.name}</p>
                  {preferredPoster && preferredPoster !== movie?.poster_path && (
                    <span className="inline-flex items-center gap-1 text-[#ffb4aa] text-[10px] font-bold uppercase tracking-widest mt-0.5">
                      <span className="material-symbols-outlined text-[10px]">auto_awesome</span>
                      Custom
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <button
                onClick={() => {
                  setShowPosterConfirm(false);
                  setShowPosterPicker(true);
                }}
                className="w-full py-3.5 rounded-full bg-[#ffb4aa] text-black font-bold text-sm active:scale-95 transition-transform cursor-pointer flex items-center justify-center gap-2 mb-2"
              >
                <span className="material-symbols-outlined text-[18px]">photo_library</span>
                Browse Poster Options
              </button>
              <button
                onClick={() => setShowPosterConfirm(false)}
                className="w-full py-3 rounded-full border border-white/10 text-white/60 text-sm active:scale-95 transition-transform cursor-pointer"
              >
                Cancel
              </button>
            </div>

            {/* Safe-area bottom padding for phones with home-bar */}
            <div className="h-safe-bottom" style={{ paddingBottom: "env(safe-area-inset-bottom, 12px)" }} />
          </div>
        </div>
      )}

      {/* Poster Picker Modal */}
      {showPosterPicker && user?.id && (
        <PosterPickerModal
          movieId={movieId}
          movieTitle={movie.title || movie.name || ""}
          currentPosterPath={preferredPoster}
          defaultPosterPath={movie.poster_path ?? null}
          userId={user.id}
          onClose={() => setShowPosterPicker(false)}
          onSelect={handlePosterSelect}
        />
      )}

      {/* YouTube Trailer Modal */}
      {showTrailerModal && trailerKey && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-4xl aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black">
            <button
              onClick={() => setShowTrailerModal(false)}
              className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white cursor-pointer border border-white/10 active:scale-90 transition-transform"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1`}
              title="YouTube movie trailer"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* Add To List Modal */}
      {showAddToListModal && user?.id && (
        <AddToListModal
          isOpen={showAddToListModal}
          onClose={() => setShowAddToListModal(false)}
          movieId={movieId}
          movieTitle={movie.title || movie.name || "Unknown Movie"}
          posterPath={preferredPoster || movie.poster_path || ""}
          contentType="movie"
          userId={user.id}
        />
      )}

      {/* Watched Date Picker Modal */}
      {showWatchedDatePicker && (
        <div
          className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowWatchedDatePicker(false)}
        >
          <div
            className="glass-panel w-full max-w-sm rounded-2xl border border-white/10 p-6 space-y-4 shadow-2xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-lg">calendar_month</span>
                <h3 className="font-serif text-base font-bold text-on-surface">Set Watched Date</h3>
              </div>
              <button
                onClick={() => setShowWatchedDatePicker(false)}
                className="text-on-surface-variant hover:text-white transition-colors cursor-pointer bg-transparent border-none"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div>
              <label className="text-xs text-on-surface-variant uppercase tracking-widest font-semibold block mb-2">
                When did you watch this?
              </label>
              <input
                type="date"
                value={watchedDate}
                onChange={(e) => setWatchedDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-on-surface text-sm focus:outline-none focus:border-primary/50 transition-all [color-scheme:dark]"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleWatchedToggle(watchedDate)}
                disabled={watchedLoading}
                className="flex-1 py-2.5 rounded-full bg-secondary text-black font-bold text-xs hover:brightness-110 active:scale-95 transition-all shadow-md cursor-pointer border-none flex items-center justify-center gap-1.5"
              >
                {watchedLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">save</span>
                    Save Date
                  </>
                )}
              </button>
              <button
                onClick={() => setShowWatchedDatePicker(false)}
                className="px-4 py-2.5 rounded-full border border-white/10 text-on-surface-variant text-xs hover:text-white transition-colors cursor-pointer bg-transparent"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.visible && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[101] bg-[#131313] text-[#e5e2e1] px-6 py-3 rounded-full border border-white/10 shadow-[0_8px_32px_rgba(255,180,170,0.15)] flex items-center gap-2 animate-fade-in">
          <span className="material-symbols-outlined text-primary">check_circle</span>
          <span className="font-semibold">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
