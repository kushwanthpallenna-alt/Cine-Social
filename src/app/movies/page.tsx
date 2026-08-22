"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { supabase } from "@/lib/supabase";
import NotificationBell from "@/components/NotificationBell";
import ReviewCard from "@/components/ReviewCard";
import Carousel from "@/components/Carousel";
import PosterPickerModal from "@/components/PosterPickerModal";
import { getAvatarUrlOrDefault } from "@/lib/avatar";



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
  37: "Western"
};

function formatRuntime(minutes: number) {
  if (!minutes) return "N/A";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}min`;
}

const DetailsSkeleton = () => (
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

function MovieDetailsView({ movieId }: { movieId: string }) {
  const { data: session } = useSession();
  const user = session?.user as any;
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const [scrollY, setScrollY] = useState(0);
  const [movie, setMovie] = useState<any>(null);
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

  // Fetch this user's preferred poster for this movie
  useEffect(() => {
    if (!user?.id || !movieId) return;
    const userId = user.id;
    fetch(`/api/poster-preference?userId=${encodeURIComponent(userId)}&movieId=${encodeURIComponent(movieId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.poster_path) setPreferredPoster(data.poster_path);
      })
      .catch(() => {});
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
    if (!user?.id || !movie) return;
    const userId = user.id;
    setWatchlistLoading(true);
    try {
      if (isInWatchlist) {
        const { error } = await supabase
          .from("watchlist")
          .delete()
          .eq("user_id", userId)
          .eq("movie_id", movieId);
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
        const res = await fetch(`/api/watched?userId=${userId}&movieId=${movieId}`);
        if (res.ok) {
          const data = await res.json();
          setIsWatched(!!data);
        }
      } catch (err) {
        console.error("Error checking watched:", err);
      }
    }
    checkWatched();
  }, [user, movieId]);

  // Toggle watched status
  const handleWatchedToggle = async () => {
    if (!user?.id || !movie) return;
    const userId = user.id;
    setWatchedLoading(true);
    try {
      if (isWatched) {
        const res = await fetch(`/api/watched?userId=${userId}&movieId=${movieId}`, {
          method: "DELETE"
        });
        if (res.ok) {
          setIsWatched(false);
          showToast("Removed from watched!");
        }
      } else {
        const res = await fetch("/api/watched", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            movie_id: movieId,
            movie_title: movie.title || movie.name || "Unknown Movie",
            poster_path: movie.poster_path || ""
          })
        });
        if (res.ok) {
          setIsWatched(true);
          showToast("Marked as watched!");
        }
      }
    } catch (err) {
      console.error("Error toggling watched:", err);
    } finally {
      setWatchedLoading(false);
    }
  };

  // Fetch user rating
  useEffect(() => {
    if (!user?.id || !movieId) return;
    const userId = user.id;
    async function fetchUserRating() {
      try {
        const { data, error } = await supabase
          .from("ratings")
          .select("rating")
          .eq("user_id", userId)
          .eq("movie_id", movieId)
          .maybeSingle();
        if (data) {
          setUserRating(data.rating);
        } else {
          setUserRating(null);
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
      const { error } = await supabase
        .from("ratings")
        .upsert({
          user_id: userId,
          movie_id: movieId,
          rating: ratingVal,
          created_at: new Date().toISOString(),
        }, { onConflict: "user_id,movie_id" });

      if (!error) {
        setUserRating(ratingVal);
        setShowRatingModal(false);
        showToast("Rating updated!");
      }
    } catch (err) {
      console.error("Error submitting rating:", err);
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
          
          // Fetch avatars & ratings for reviewers
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
              link: `/movies?id=${movieId}`,
            }),
          }).catch(() => {});
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
    if (!user?.id || !movieId || !newReviewText.trim()) return;
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
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    async function fetchMovieDetails() {
      setLoading(true);
      setError(null);
      try {
        const [movieRes, creditsRes, similarRes, reviewsRes, videosRes] = await Promise.all([
          fetch(`/api/tmdb?endpoint=movie/${movieId}`),
          fetch(`/api/tmdb?endpoint=movie/${movieId}/credits`),
          fetch(`/api/tmdb?endpoint=movie/${movieId}/similar`),
          fetch(`/api/tmdb?endpoint=movie/${movieId}/reviews`),
          fetch(`/api/tmdb?endpoint=movie/${movieId}/videos`)
        ]);

        if (!movieRes.ok) {
          throw new Error(`Failed to fetch movie details (status ${movieRes.status})`);
        }

        const movieData = await movieRes.json();
        const creditsData = await creditsRes.json();
        const similarData = await similarRes.json();
        const reviewsData = await reviewsRes.json();
        const videosData = await videosRes.json();

        setMovie(movieData);
        if (creditsData.cast) {
          setCast(creditsData.cast.slice(0, 10)); // Display top 10 cast members
        }
        if (creditsData.crew) {
          const dirs = creditsData.crew.filter((c: any) => c.job === "Director");
          setDirectors(dirs);
        }
        if (similarData.results) {
          setSimilarMovies(similarData.results.slice(0, 5)); // Display top 5 similar movies
        }
        if (videosData.results) {
          const trailer = videosData.results.find((v: any) => v.site === "YouTube" && v.type === "Trailer");
          if (trailer) {
            setTrailerKey(trailer.key);
          } else {
            // fallback to any video if no trailer
            const anyVideo = videosData.results.find((v: any) => v.site === "YouTube");
            if (anyVideo) setTrailerKey(anyVideo.key);
          }
        }
        
        // Use TMDB reviews if available, otherwise set default fallback reviews
        if (reviewsData.results && reviewsData.results.length > 0) {
          setReviews(reviewsData.results.slice(0, 2));
        } else {
          setReviews([
            {
              id: "fallback-1",
              author: "Julian Dreyfus",
              content: "A technical masterpiece. The sound design alone is enough to leave you breathless. Haunting storytelling that keeps you fully engaged.",
              author_details: { rating: 10 }
            },
            {
              id: "fallback-2",
              author: "Maya K.",
              content: "Incredible pacing and powerful performances. Densely layered and extremely rewarding. A must watch movie.",
              author_details: { rating: 9 }
            }
          ]);
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
      {/* Top Navigation Bar — Letterboxd-style transparent blended header */}
      <header className="fixed top-0 left-0 w-full z-50 bg-gradient-to-b from-[#050505]/90 via-[#050505]/40 to-transparent flex justify-between items-center px-container-margin py-stack-md transition-all duration-300">
        <Link
          href="/"
          className="flex items-center gap-stack-sm hover:opacity-80 transition-opacity cursor-pointer text-primary drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
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

      {/* Main Content Canvas */}
      <main className="relative pt-[60px]">
        {/* Cinematic Backdrop */}
        <section className="relative h-[574px] w-full overflow-hidden">
          <img
            className="w-full h-full object-cover scale-105 transition-transform duration-100 animate-fade-in"
            style={{ transform: `scale(1.05) translateY(${scrollY * 0.3}px)` }}
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

                {/* Change Poster button — always visible on mobile, hover-only on desktop */}
                {user?.id && (
                  <>
                    {/* Desktop: hover-reveal icon button (unchanged behaviour) */}
                    <button
                      onClick={() => setShowPosterPicker(true)}
                      title="Change poster"
                      aria-label="Change poster"
                      className="hidden md:flex absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md items-center justify-center text-white border border-white/20 transition-all duration-200 cursor-pointer shadow-lg hover:scale-110 active:scale-95 opacity-0 group-hover/poster:opacity-100"
                    >
                      <span className="material-symbols-outlined text-[16px]">collections</span>
                    </button>

                    {/* Mobile: always-visible pill button with "Edit" label */}
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

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-stack-md">
                <button
                  onClick={handleWatchlistToggle}
                  disabled={watchlistLoading}
                  className={`px-6 py-3 rounded-full font-title-lg flex items-center gap-2 active:scale-95 transition-all duration-200 cursor-pointer border-none ${
                    isInWatchlist
                      ? "bg-primary text-black shadow-[0_0_20px_rgba(255,180,170,0.35)]"
                      : "bg-primary-container text-on-primary-container"
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: isInWatchlist ? "'FILL' 1" : "" }}>
                    {isInWatchlist ? "bookmark_added" : "bookmark_add"}
                  </span>
                  {isInWatchlist ? "In Watchlist" : "Add to Watchlist"}
                </button>
                <button
                  onClick={handleWatchedToggle}
                  disabled={watchedLoading}
                  className={`px-6 py-3 rounded-full font-title-lg flex items-center gap-2 active:scale-95 transition-all duration-200 cursor-pointer border-none ${
                    isWatched
                      ? "bg-secondary text-black shadow-[0_0_20px_rgba(233,195,73,0.35)]"
                      : "bg-primary-container text-on-primary-container"
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: isWatched ? "'FILL' 1" : "" }}>
                    {isWatched ? "visibility" : "visibility_off"}
                  </span>
                  {isWatched ? "Watched" : "Mark as Watched"}
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
                    setHoverRating(userRating || 5);
                    setShowRatingModal(true);
                  }}
                  className={`px-6 py-3 rounded-full font-title-lg flex items-center gap-2 active:scale-95 transition-all duration-200 glass-card cursor-pointer border ${
                    userRating
                      ? "border-primary text-primary shadow-[0_0_15px_rgba(255,180,170,0.15)]"
                      : "border-secondary text-secondary"
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                    grade
                  </span>
                  {userRating ? `Your Rating: ${userRating}/10` : "Rate Now"}
                </button>
                <button className="glass-card text-on-surface p-3 rounded-full active:scale-90 transition-transform cursor-pointer">
                  <span className="material-symbols-outlined">share</span>
                </button>
              </div>
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

              {/* TMDB / Fallback Reviews */}
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
                    <Link key={sim.id} href={`/movies?id=${sim.id}`} className="group cursor-pointer block">
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

      {/* FAB: Rate Now */}
      <button className="fixed bottom-24 right-6 z-50 px-6 py-3 rounded-full bg-gradient-to-br from-secondary to-primary text-on-primary font-bold shadow-[0_8px_32px_rgba(233,195,73,0.3)] active:scale-90 transition-all flex items-center gap-2 cursor-pointer border-none">
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
          star
        </span>
        Check-in
      </button>

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

            <div className="flex flex-col items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-secondary to-primary-container text-on-primary-container font-serif text-[28px] flex items-center justify-center shadow-[0_0_20px_rgba(255,180,170,0.3)] animate-pulse mb-2">
                {hoverRating || userRating || 5}
              </div>

              <input
                type="range"
                min="1"
                max="10"
                value={hoverRating || userRating || 5}
                onChange={(e) => setHoverRating(parseInt(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
              />

              <div className="flex justify-between w-full text-[10px] text-on-surface-variant uppercase tracking-widest px-1 font-bold opacity-60">
                <span>1 - Awful</span>
                <span>5 - Good</span>
                <span>10 - Masterpiece</span>
              </div>
            </div>

            <button
              onClick={() => handleRatingSubmit(hoverRating || userRating || 5)}
              disabled={isRatingSubmitting}
              className="w-full bg-white text-black py-3 rounded-full font-bold shadow-lg hover:shadow-white/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 text-body-lg"
            >
              {isRatingSubmitting && (
                <div className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              )}
              Confirm Rating
            </button>
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

function WatchlistView() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Map of movie_id → preferred poster_path
  const [posterPrefs, setPosterPrefs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    const fetchWatchlist = async () => {
      try {
        const { data, error } = await supabase
          .from("watchlist")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (data) {
          setWatchlist(data);
          // Batch-fetch poster preferences for all watchlist movies
          if (data.length > 0) {
            const movieIds = data.map((m: any) => String(m.movie_id));
            fetch("/api/poster-preference/batch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ user_id: user.id, movie_ids: movieIds }),
            })
              .then((r) => r.json())
              .then((prefs: { movie_id: string; poster_path: string }[]) => {
                if (Array.isArray(prefs)) {
                  const map: Record<string, string> = {};
                  prefs.forEach((p) => { map[p.movie_id] = p.poster_path; });
                  setPosterPrefs(map);
                }
              })
              .catch(() => {});
          }
        }
      } catch (err) {
        console.error("Error fetching watchlist:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchWatchlist();
  }, [user]);

  return (
    <div className="bg-[#050505] text-[#e5e2e1] font-body-md overflow-x-clip min-h-screen relative pb-32">
      <header className="fixed top-0 left-0 w-full z-50 bg-[#131313]/60 backdrop-blur-[40px] border-b border-white/10 flex justify-between items-center px-container-margin py-stack-md shadow-[0_8px_32px_0_rgba(255,180,170,0.05)]">
        <Link href="/" className="hover:opacity-90 active:scale-98 transition-all block">
          <h1 className="font-display-md text-[24px] text-primary tracking-tighter uppercase select-none font-serif">
            YOUR WATCHLIST
          </h1>
        </Link>
      </header>

      <main className="pt-[100px] px-container-margin max-w-screen-xl mx-auto w-full">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : !user ? (
          <div className="text-center py-20 glass-card rounded-xl border border-white/10 max-w-md mx-auto">
            <span className="material-symbols-outlined text-[48px] text-primary mb-4">account_circle</span>
            <h2 className="font-title-lg text-title-lg mb-2">Sign in Required</h2>
            <p className="text-on-surface-variant mb-6">Please sign in to view your saved movies.</p>
            <Link href="/auth/signin" className="bg-primary text-black px-6 py-3 rounded-full font-bold inline-block">
              Sign In
            </Link>
          </div>
        ) : watchlist.length === 0 ? (
          <div className="text-center py-20 glass-card rounded-xl border border-white/10 max-w-md mx-auto">
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant/50 mb-4">bookmark_border</span>
            <h2 className="font-title-lg text-title-lg mb-2">Your Watchlist is Empty</h2>
            <p className="text-on-surface-variant">Movies you save will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-stack-md">
            {watchlist.map((movie: any) => {
              const displayPoster = posterPrefs[String(movie.movie_id)] ?? movie.poster_path;
              return (
                <Link key={movie.id} href={`/movies?id=${movie.movie_id}`} className="group cursor-pointer block relative">
                  <div className="aspect-[2/3] rounded-xl overflow-hidden border border-white/10 relative mb-2">
                    <img
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      alt={movie.movie_title || "Movie Poster"}
                      src={displayPoster ? `https://image.tmdb.org/t/p/w500${displayPoster}` : "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500"}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                  <h4 className="text-body-md font-bold truncate group-hover:text-primary transition-colors">{movie.movie_title}</h4>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      
      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-[60px] z-50 mb-container-margin mx-container-margin rounded-full bg-surface/40 backdrop-blur-[100px] border border-white/10 flex justify-around items-center px-6 shadow-[0_0_20px_rgba(255,180,170,0.1)] max-w-md md:left-1/2 md:-translate-x-1/2">
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/"><span className="material-symbols-outlined">home</span></Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/recommendations"><span className="material-symbols-outlined">search</span></Link>
        <Link className="flex items-center justify-center text-primary relative after:content-[''] after:absolute after:-bottom-2 after:w-1 after:h-1 after:bg-primary after:rounded-full after:shadow-[0_0_8px_#ffb4aa] active:scale-90" href="/movies"><span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>bookmark</span></Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/community"><span className="material-symbols-outlined">group</span></Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/profile"><span className="material-symbols-outlined">person</span></Link>
      </nav>
    </div>
  );
}

function MovieDetailsContent() {
  const searchParams = useSearchParams();
  const movieId = searchParams.get("id");
  if (!movieId) return <WatchlistView />;
  return <MovieDetailsView movieId={movieId} />;
}

export default function MovieDetails() {
  return (
    <Suspense fallback={<DetailsSkeleton />}>
      <MovieDetailsContent />
    </Suspense>
  );
}
