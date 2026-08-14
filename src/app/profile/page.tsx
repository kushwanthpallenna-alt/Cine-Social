"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSession, signOut } from "next-auth/react";
import ReviewCard from "@/components/ReviewCard";
import { getSafeAvatarUrl, getAvatarUrlOrDefault } from "@/lib/avatar";

type SortOption = 
  | "default"
  | "rating_desc"
  | "rating_asc"
  | "year_desc"
  | "year_asc"
  | "title_asc";

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: "default", label: "Default (Date Watched)" },
  { id: "rating_desc", label: "Rating (Highest)" },
  { id: "rating_asc", label: "Rating (Lowest)" },
  { id: "year_desc", label: "Release Year (Newest)" },
  { id: "year_asc", label: "Release Year (Oldest)" },
  { id: "title_asc", label: "Title (A-Z)" },
];

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

const ProfileSkeleton = () => (
  <div className="animate-skeleton-pulse pt-4 space-y-8">
    {/* Profile Header Skeleton (Profile Picture, Name, Email, Stats) */}
    <div className="flex flex-col md:flex-row items-center md:items-start gap-8 mb-8">
      {/* Profile Picture Skeleton */}
      <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-white/10 border-4 border-white/10 shadow-[0_0_30px_rgba(255,180,170,0.05)] animate-skeleton-pulse flex-shrink-0"></div>
      
      {/* User Details & Stats Skeleton */}
      <div className="flex-grow space-y-4 pt-2 text-center md:text-left">
        <div className="flex flex-wrap items-center gap-3 justify-center md:justify-start">
          <div className="h-9 bg-white/15 rounded-lg w-48 animate-skeleton-pulse"></div>
          <div className="h-7 bg-white/10 rounded-full w-24 animate-skeleton-pulse"></div>
        </div>
        <div className="h-4 bg-white/10 rounded-md w-36 mx-auto md:mx-0 animate-skeleton-pulse"></div>
        
        {/* Stats Row Skeleton */}
        <div className="flex justify-center md:justify-start gap-6 pt-2">
          <div className="text-center space-y-1">
            <div className="h-7 bg-white/15 rounded-md w-12 mx-auto animate-skeleton-pulse"></div>
            <div className="h-3 bg-white/10 rounded w-16 animate-skeleton-pulse"></div>
          </div>
          <div className="h-10 w-px bg-white/10"></div>
          <div className="text-center space-y-1">
            <div className="h-7 bg-white/15 rounded-md w-12 mx-auto animate-skeleton-pulse"></div>
            <div className="h-3 bg-white/10 rounded w-16 animate-skeleton-pulse"></div>
          </div>
          <div className="h-10 w-px bg-white/10"></div>
          <div className="text-center space-y-1">
            <div className="h-7 bg-white/15 rounded-md w-12 mx-auto animate-skeleton-pulse"></div>
            <div className="h-3 bg-white/10 rounded w-16 animate-skeleton-pulse"></div>
          </div>
        </div>
      </div>
    </div>

    {/* Navigation Tabs Skeleton */}
    <div className="flex gap-4 border-b border-white/10 pb-3">
      <div className="h-6 bg-white/15 rounded-md w-24 animate-skeleton-pulse"></div>
      <div className="h-6 bg-white/10 rounded-md w-24 animate-skeleton-pulse"></div>
      <div className="h-6 bg-white/10 rounded-md w-24 animate-skeleton-pulse"></div>
      <div className="h-6 bg-white/10 rounded-md w-24 animate-skeleton-pulse"></div>
    </div>

    {/* Watched Filter & Grid Skeleton */}
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-7 bg-white/10 rounded-full w-28 flex-shrink-0 animate-skeleton-pulse"></div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-stack-md">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="aspect-[2/3] rounded-xl bg-white/10 border border-white/5 animate-skeleton-pulse"></div>
            <div className="h-4 bg-white/10 rounded-md w-3/4 animate-skeleton-pulse"></div>
            <div className="h-3 bg-white/5 rounded-md w-1/2 animate-skeleton-pulse"></div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default function ProfilePage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [loading, setLoading] = useState(true);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [watched, setWatched] = useState<any[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [movieDetails, setMovieDetails] = useState<Record<string, any>>({});
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Avatar modal state
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);

  // Bio state
  const [bio, setBio] = useState<string>("");
  const [bioEditing, setBioEditing] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [bioSaving, setBioSaving] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);

  // Username state
  const [username, setUsername] = useState<string>("");
  const [usernameEditing, setUsernameEditing] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  
  // Favorites State
  const [favorites, setFavorites] = useState<Record<string, any>>({});
  const [searchModal, setSearchModal] = useState<{ isOpen: boolean; type: "movie" | "person"; slotType: string } | null>(null);
  const [optionsModal, setOptionsModal] = useState<{ isOpen: boolean; slotType: string; name: string } | null>(null);
  
  const [activeTab, setActiveTab] = useState<"watched" | "watchlist" | "reviews" | "stats">("watched");
  const [watchedSort, setWatchedSort] = useState<SortOption>("default");

  // Profile Reviews Edit State
  const [profileEditReviewId, setProfileEditReviewId] = useState<string | null>(null);
  const [profileEditText, setProfileEditText] = useState("");
  const [profileEditSubmitting, setProfileEditSubmitting] = useState(false);

  // Followers / Following
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [followListModal, setFollowListModal] = useState<{ type: "followers" | "following"; users: any[]; loading: boolean } | null>(null);

  // Cinematic Profile Banner State
  const [bannerBackdropUrl, setBannerBackdropUrl] = useState<string | null>(null);
  const [bannerMovieTitle, setBannerMovieTitle] = useState<string | null>(null);

  // Poster preferences map: movie_id -> preferred poster_path
  const [posterPrefs, setPosterPrefs] = useState<Record<string, string>>({});

  // Fetch TMDB backdrop_path for Film 1 in Top 5
  useEffect(() => {
    const film1 = favorites["movie_1"];
    if (!film1?.tmdb_id) {
      setBannerBackdropUrl(null);
      setBannerMovieTitle(null);
      return;
    }

    let isMounted = true;
    async function fetchBannerBackdrop() {
      try {
        const res = await fetch(`/api/tmdb?endpoint=movie/${film1.tmdb_id}&append_to_response=images`);
        if (res.ok) {
          const data = await res.json();
          if (!isMounted) return;
          const backdropPath = data.backdrop_path || data.images?.backdrops?.[0]?.file_path;
          if (backdropPath) {
            setBannerBackdropUrl(`https://image.tmdb.org/t/p/w1280${backdropPath}`);
            setBannerMovieTitle(data.title || film1.name);
          } else {
            setBannerBackdropUrl(null);
            setBannerMovieTitle(null);
          }
        }
      } catch (err) {
        console.error("Error fetching banner backdrop:", err);
        if (isMounted) {
          setBannerBackdropUrl(null);
          setBannerMovieTitle(null);
        }
      }
    }

    fetchBannerBackdrop();
    return () => {
      isMounted = false;
    };
  }, [favorites]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    async function fetchUserData() {
      try {
        const [watchlistRes, ratingsRes, reviewsRes] = await Promise.all([
          supabase.from("watchlist").select("*").eq("user_id", user.id),
          supabase.from("ratings").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
          supabase.from("reviews").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
        ]);

        // Fetch follow counts
        try {
          const fRes = await fetch(`/api/follows?userId=${user.id}`);
          if (fRes.ok) {
            const fData = await fRes.json();
            setFollowCounts({ followers: fData.followerCount || 0, following: fData.followingCount || 0 });
          }
        } catch {}

        const watchlistData = watchlistRes.data || [];
        const ratingsData = ratingsRes.data || [];
        const reviewsData = reviewsRes.data || [];

        // Fetch watched movies and profile via API routes to bypass RLS issues
        let watchedData: any[] = [];
        try {
          const wRes = await fetch(`/api/watched?userId=${user.id}`);
          if (wRes.ok) watchedData = await wRes.json();
        } catch (e) {
          console.error("Failed to fetch watched list via API", e);
        }

        try {
          const pRes = await fetch(`/api/profile/upload?userId=${user.id}`);
          if (pRes.ok) {
            const pData = await pRes.json();
            if (pData?.avatar_url) setAvatarUrl(pData.avatar_url);
            if (pData?.bio != null) setBio(pData.bio);
            if (pData?.username != null) setUsername(pData.username);
          }
        } catch (e) {
          console.error("Failed to fetch profile via API", e);
        }

        // Fetch favorites
        let favoritesData: any[] = [];
        try {
          const fRes = await fetch(`/api/favorites?userId=${user.id}`);
          if (fRes.ok) {
            favoritesData = await fRes.json();
          }
        } catch (e) {
          console.error("Failed to fetch favorites", e);
        }

        const favsMap: Record<string, any> = {};
        favoritesData.forEach(fav => {
          favsMap[fav.slot_type] = fav;
        });
        setFavorites(favsMap);

        setWatchlist(watchlistData);
        setWatched(watchedData);
        setRatings(ratingsData);
        setReviews(reviewsData);

        // Fetch TMDB details for rated, watched, reviews and watchlist movies
        const uniqueIds = new Set<string>();
        ratingsData.forEach(r => uniqueIds.add(r.movie_id));
        reviewsData.forEach(r => uniqueIds.add(r.movie_id));
        watchedData.forEach(w => uniqueIds.add(w.movie_id));
        watchlistData.forEach(wl => uniqueIds.add(wl.movie_id));

        const details: Record<string, any> = {};
        await Promise.all(
          Array.from(uniqueIds).map(async (id) => {
            try {
              const res = await fetch(`/api/tmdb?endpoint=movie/${id}&append_to_response=credits`);
              if (res.ok) {
                details[id] = await res.json();
              }
            } catch (e) {
              console.error(`Failed to fetch TMDB for ${id}`, e);
            }
          })
        );
        
        setMovieDetails(details);

        // Batch-fetch poster preferences for all movies the user has interacted with
        if (uniqueIds.size > 0) {
          fetch("/api/poster-preference/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: user.id, movie_ids: Array.from(uniqueIds) }),
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
      } catch (err) {
        console.error("Error fetching user data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [user]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error("You must select an image to upload.");
      }

      const file = event.target.files[0];
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", user.id);

      const res = await fetch("/api/profile/upload", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Upload failed");
      }

      const data = await res.json();
      if (data.avatar_url) {
        setAvatarUrl(data.avatar_url);
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveBio = async () => {
    if (!user?.id) return;
    setBioSaving(true);
    setBioError(null);
    try {
      const res = await fetch("/api/profile/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, bio: bioDraft }),
      });
      const data = await res.json();
      if (!res.ok) { setBioError(data.error || "Failed to save bio"); return; }
      setBio(data.bio ?? "");
      setBioEditing(false);
    } catch (e: any) {
      setBioError(e.message);
    } finally {
      setBioSaving(false);
    }
  };

  const handleSaveUsername = async () => {
    if (!user?.id) return;
    setUsernameSaving(true);
    setUsernameError(null);
    try {
      const res = await fetch("/api/profile/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, username: usernameDraft }),
      });
      const data = await res.json();
      if (!res.ok) { setUsernameError(data.error || "Failed to save username"); return; }
      setUsername(data.username ?? "");
      setUsernameEditing(false);
    } catch (e: any) {
      setUsernameError(e.message);
    } finally {
      setUsernameSaving(false);
    }
  };

  const handleRemoveFromWatchlist = async (movieId: string) => {
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from("watchlist")
        .delete()
        .eq("user_id", user.id)
        .eq("movie_id", movieId);
      if (!error) {
        setWatchlist(prev => prev.filter(item => item.movie_id !== movieId));
      }
    } catch (err) {
      console.error("Error removing from watchlist:", err);
    }
  };

  // Debounced TMDB search logic
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!searchModal?.isOpen || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setSearching(true);
      try {
        const endpoint = searchModal.type === "movie" ? "search/movie" : "search/person";
        const res = await fetch(`/api/tmdb?endpoint=${endpoint}&query=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch (err) {
        console.error("Error searching TMDB:", err);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, searchModal]);

  const handleSaveFavorite = async (item: any) => {
    if (!user?.id || !searchModal) return;
    // Capture slot info before any async state changes
    const slot_type = searchModal.slotType;
    const tmdb_id = item.id.toString();
    const name = item.title || item.name;
    const image_url = item.poster_path || item.profile_path || "";

    // Optimistically close the modal and update UI immediately
    setSearchModal(null);
    setSearchQuery("");
    setSearchResults([]);
    setFavorites(prev => ({
      ...prev,
      [slot_type]: { slot_type, tmdb_id, name, image_url }
    }));

    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          slot_type,
          tmdb_id,
          name,
          image_url
        })
      });

      if (res.ok) {
        const savedItem = await res.json();
        // If the API returned the saved row, use it; otherwise keep the optimistic value
        if (savedItem) {
          setFavorites(prev => ({ ...prev, [slot_type]: savedItem }));
        }
      } else {
        const errBody = await res.json().catch(() => ({}));
        console.error("Error saving favorite:", errBody);
      }
    } catch (err) {
      console.error("Error saving favorite:", err);
    }
  };

  const handleRemoveFavorite = async (slotType: string) => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/favorites?userId=${user.id}&slotType=${slotType}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setFavorites(prev => {
          const updated = { ...prev };
          delete updated[slotType];
          return updated;
        });
        setOptionsModal(null);
      }
    } catch (err) {
      console.error("Error removing favorite:", err);
    }
  };

  const openFollowList = async (type: "followers" | "following") => {
    setFollowListModal({ type, users: [], loading: true });
    try {
      const res = await fetch(`/api/follows?userId=${user.id}`);
      const data = await res.json();
      const ids: string[] = type === "followers" ? (data.followers || []) : (data.following || []);
      // Fetch each user's profile
      const profiles = await Promise.all(
        ids.map(async (uid: string) => {
          try {
            const r = await fetch(`/api/user-profile?userId=${uid}`);
            if (r.ok) return await r.json();
          } catch {}
          return null;
        })
      );
      setFollowListModal({ type, users: profiles.filter(Boolean), loading: false });
    } catch {
      setFollowListModal(prev => prev ? { ...prev, loading: false } : null);
    }
  };

  // Calculate Stats
  const watchedCount = watched.length;
  
  // Profile review edit/delete handlers
  const handleProfileDeleteReview = async (reviewId: string) => {
    if (!confirm("Are you sure you want to delete this review?")) return;
    try {
      const { error } = await supabase.from("reviews").delete().eq("id", reviewId);
      if (!error) {
        setReviews(prev => prev.filter(r => r.id !== reviewId));
      }
    } catch (e) {
      console.error("Error deleting review:", e);
    }
  };

  const handleProfileSaveEdit = async (reviewId: string) => {
    if (!profileEditText.trim()) return;
    setProfileEditSubmitting(true);
    try {
      const { error } = await supabase
        .from("reviews")
        .update({ review_text: profileEditText.trim() })
        .eq("id", reviewId);
      if (!error) {
        setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, review_text: profileEditText.trim() } : r));
        setProfileEditReviewId(null);
      }
    } catch (e) {
      console.error("Error updating review:", e);
    } finally {
      setProfileEditSubmitting(false);
    }
  };

  // Cinema DNA Computations from watched movies & TMDB details
  const cinemaDnaData = useMemo(() => {
    if (!watched || watched.length === 0) {
      return {
        topGenres: [],
        topDecade: "N/A",
        decadePercent: 0,
        avgRatingVal: 0,
        totalRuntimeMinutes: 0,
        formattedRuntime: "0h 0m",
      };
    }

    // 1. Genre Counts across watched movies
    const genreCounts: Record<string, number> = {};
    let totalGenreHits = 0;

    watched.forEach(w => {
      const movie = movieDetails[w.movie_id];
      if (movie?.genres && Array.isArray(movie.genres)) {
        movie.genres.forEach((g: any) => {
          genreCounts[g.name] = (genreCounts[g.name] || 0) + 1;
          totalGenreHits++;
        });
      } else if (movie?.genre_ids && Array.isArray(movie.genre_ids)) {
        movie.genre_ids.forEach((gid: number) => {
          const name = GENRE_MAP[gid] || "Other";
          genreCounts[name] = (genreCounts[name] || 0) + 1;
          totalGenreHits++;
        });
      }
    });

    const genreColorPalette = ["#e9c349", "#ffb4aa", "#38bdf8", "#a855f7", "#34d399"];

    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count], index) => ({
        name,
        count,
        percentage: totalGenreHits > 0 ? Math.round((count / totalGenreHits) * 100) : 0,
        color: genreColorPalette[index % genreColorPalette.length]
      }));

    // 2. Cinema Era / Decades
    const decadeCounts: Record<string, number> = {};
    watched.forEach(w => {
      const movie = movieDetails[w.movie_id] || w;
      const releaseDate = movie?.release_date || movie?.year;
      if (releaseDate) {
        const year = parseInt(String(releaseDate).substring(0, 4), 10);
        if (!isNaN(year) && year > 1900) {
          const decade = `${Math.floor(year / 10) * 10}s`;
          decadeCounts[decade] = (decadeCounts[decade] || 0) + 1;
        }
      }
    });

    let topDecade = "2020s";
    let maxDecadeCount = 0;
    Object.entries(decadeCounts).forEach(([decade, count]) => {
      if (count > maxDecadeCount) {
        maxDecadeCount = count;
        topDecade = decade;
      }
    });
    const decadePercent = watched.length > 0 ? Math.round((maxDecadeCount / watched.length) * 100) : 0;

    // 3. Average Rating
    let avgRatingVal = 0;
    if (ratings.length > 0) {
      const sum = ratings.reduce((acc, curr) => acc + (curr.rating || 0), 0);
      avgRatingVal = parseFloat((sum / ratings.length).toFixed(1));
    }

    // 4. Total Watch Time (Runtime)
    let totalRuntimeMinutes = 0;
    watched.forEach(w => {
      const movie = movieDetails[w.movie_id];
      const runtime = movie?.runtime ? parseInt(movie.runtime, 10) : 110;
      totalRuntimeMinutes += runtime;
    });

    const hours = Math.floor(totalRuntimeMinutes / 60);
    const mins = totalRuntimeMinutes % 60;
    const formattedRuntime = `${hours}h ${mins}m`;

    return {
      topGenres,
      topDecade,
      decadePercent,
      avgRatingVal,
      totalRuntimeMinutes,
      formattedRuntime,
    };
  }, [watched, movieDetails, ratings]);

  // Build a movie_id → rating lookup map for the watched grid overlay
  const ratingsMap: Record<string, number> = {};
  ratings.forEach(r => { ratingsMap[r.movie_id] = r.rating; });

  const sortedWatched = useMemo(() => {
    if (!watched || watched.length === 0) return [];
    const list = [...watched];

    return list.sort((a, b) => {
      if (watchedSort === "rating_desc" || watchedSort === "rating_asc") {
        const ratingA = ratingsMap[a.movie_id] ?? movieDetails[a.movie_id]?.vote_average ?? 0;
        const ratingB = ratingsMap[b.movie_id] ?? movieDetails[b.movie_id]?.vote_average ?? 0;
        if (ratingA !== ratingB) {
          return watchedSort === "rating_desc" ? ratingB - ratingA : ratingA - ratingB;
        }
      }

      if (watchedSort === "year_desc" || watchedSort === "year_asc") {
        const movieA = movieDetails[a.movie_id] || a;
        const movieB = movieDetails[b.movie_id] || b;
        const dateA = movieA.release_date || movieA.year || "";
        const dateB = movieB.release_date || movieB.year || "";
        const yearA = dateA ? parseInt(String(dateA).substring(0, 4), 10) || 0 : 0;
        const yearB = dateB ? parseInt(String(dateB).substring(0, 4), 10) || 0 : 0;
        if (yearA !== yearB) {
          return watchedSort === "year_desc" ? yearB - yearA : yearA - yearB;
        }
      }

      if (watchedSort === "title_asc") {
        const movieA = movieDetails[a.movie_id] || a;
        const movieB = movieDetails[b.movie_id] || b;
        const titleA = String(movieA.movie_title || movieA.title || "").toLowerCase();
        const titleB = String(movieB.movie_title || movieB.title || "").toLowerCase();
        const comp = titleA.localeCompare(titleB);
        if (comp !== 0) return comp;
      }

      // Default or fallback: date watched (newest first)
      const timeA = a.watched_at ? new Date(a.watched_at).getTime() : 0;
      const timeB = b.watched_at ? new Date(b.watched_at).getTime() : 0;
      return timeB - timeA;
    });
  }, [watched, watchedSort, movieDetails, ratingsMap]);

  // Calculate Badges
  const badges: { name: string; icon: string; desc: string }[] = [];
  
  if (watchedCount >= 100) {
    badges.push({ name: "Century Club", icon: "workspace_premium", desc: "Watched 100+ movies" });
  }

  const uniqueGenres = new Set<number>();
  watched.forEach(w => {
    const movie = movieDetails[w.movie_id];
    if (movie?.genres) {
      movie.genres.forEach((g: any) => uniqueGenres.add(g.id));
    }
  });
  if (uniqueGenres.size >= 8) {
    badges.push({ name: "Genre Explorer", icon: "explore", desc: "Watched across 8+ genres" });
  }

  const directorCounts: Record<string, number> = {};
  watched.forEach(w => {
    const movie = movieDetails[w.movie_id];
    if (movie?.credits?.crew) {
      const director = movie.credits.crew.find((c: any) => c.job === "Director");
      if (director) {
        directorCounts[director.name] = (directorCounts[director.name] || 0) + 1;
      }
    }
  });
  if (Object.values(directorCounts).some(count => count >= 5)) {
    badges.push({ name: "Tarkovsky Completionist", icon: "movie_filter", desc: "Watched 5+ films by a director" });
  }

  return (
    <div className="font-body-md text-body-md bg-[#050505] text-[#e5e2e1] min-h-screen relative pb-32 overflow-x-clip">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-50 bg-[#131313]/60 backdrop-blur-[40px] border-b border-white/10 flex justify-between items-center px-container-margin py-stack-md shadow-[0_8px_32px_0_rgba(255,180,170,0.05)]">
        <Link href="/" className="hover:opacity-90 active:scale-98 transition-all block">
          <h1 className="font-display-md text-[24px] text-primary tracking-tighter uppercase select-none font-serif">
            PROFILE
          </h1>
        </Link>
        <div className="flex items-center gap-stack-md">
          <button className="material-symbols-outlined text-on-surface-variant hover:opacity-80 transition-opacity cursor-pointer">
            settings
          </button>
          <button 
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            className="material-symbols-outlined text-primary hover:opacity-80 transition-opacity cursor-pointer"
          >
            logout
          </button>
        </div>
      </header>

      {/* Letterboxd-Style Cinematic Profile Banner */}
      <div className="relative w-full h-[300px] sm:h-[380px] md:h-[460px] overflow-hidden bg-[#050505]">
        {bannerBackdropUrl ? (
          <>
            <img
              src={bannerBackdropUrl}
              alt={bannerMovieTitle || "Profile Banner"}
              className="w-full h-full object-cover scale-105 filter brightness-[0.9] transition-all duration-700 animate-fade-in"
              style={{ objectPosition: 'center 35%' }}
            />
            {bannerMovieTitle && (
              <div className="absolute top-20 right-6 z-20 text-right pointer-events-none hidden md:block">
                <span className="text-[10px] uppercase tracking-widest text-white/50 block font-bold">Top Film Backdrop</span>
                <span className="text-xs text-white/80 font-serif italic drop-shadow-md">{bannerMovieTitle}</span>
              </div>
            )}
          </>
        ) : (
          /* Default Dark Cinematic Gradient Placeholder */
          <div className="w-full h-full bg-gradient-to-r from-[#0d0d14] via-[#1a0a14] to-[#0a121a] relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#e50914_0%,transparent_70%)] opacity-20" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,#e9c349_0%,transparent_70%)] opacity-10" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem]" />
          </div>
        )}

        {/* Top dark gradient overlay for fixed header readability */}
        <div className="absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-[#050505]/90 via-[#050505]/40 to-transparent z-10 pointer-events-none" />

        {/* Bottom smooth cinematic gradient overlay fading into solid #050505 */}
        <div className="absolute inset-0 profile-banner-fade z-10 pointer-events-none" />
      </div>

      {/* Main Container - Overlapping Banner Bottom (Letterboxd Style) */}
      <main className="-mt-20 sm:-mt-24 md:-mt-32 relative z-20 px-container-margin max-w-screen-xl mx-auto w-full">
        {loading ? (
          <ProfileSkeleton />
        ) : !user ? (
          <div className="text-center py-20 glass-card rounded-xl border border-white/10 max-w-md mx-auto">
            <span className="material-symbols-outlined text-[48px] text-primary mb-4">account_circle</span>
            <h2 className="font-title-lg text-title-lg mb-2">Sign in Required</h2>
            <p className="text-on-surface-variant mb-6">Please sign in to view your profile.</p>
            <Link href="/auth/signin" className="bg-primary text-black px-6 py-3 rounded-full font-bold inline-block">
              Sign In
            </Link>
          </div>
        ) : (
          <>
            {/* User Info Header (Letterboxd Overlapping Style) */}
            <section className="flex flex-col md:flex-row items-center md:items-start gap-8 mb-12">
              {/* Avatar — click to open full-screen modal */}
              <button
                onClick={() => setAvatarModalOpen(true)}
                className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-[#050505] shadow-[0_12px_40px_rgba(0,0,0,0.85)] relative group bg-[#131313] flex-shrink-0 cursor-pointer focus:outline-none"
                aria-label="View or change profile picture"
              >
                <img src={getAvatarUrlOrDefault(avatarUrl || user?.image)} alt="Profile" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="material-symbols-outlined text-white text-3xl">zoom_in</span>
                </div>
              </button>

              <div className="text-center md:text-left flex-grow">
                <div className="flex flex-wrap items-center gap-4 mb-1 justify-center md:justify-start">
                  <h2 className="font-display-lg text-headline-lg font-serif">{user.name || "Cine Member"}</h2>
                  {badges.length > 0 && (
                    <div className="flex gap-2">
                      {badges.map(b => (
                        <div key={b.name} title={b.desc} className="bg-primary/20 p-1.5 rounded-full flex items-center justify-center border border-primary/40 cursor-help">
                          <span className="material-symbols-outlined text-primary text-sm">{b.icon}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Username row */}
                <div className="flex flex-wrap items-center gap-2 mb-2 justify-center md:justify-start">
                  {usernameEditing ? (
                    <div className="flex flex-col gap-1 w-full md:w-auto">
                      <div className="flex items-center gap-2">
                        <span className="text-on-surface-variant text-sm">@</span>
                        <input
                          type="text"
                          value={usernameDraft}
                          onChange={e => { setUsernameDraft(e.target.value); setUsernameError(null); }}
                          placeholder="your_username"
                          maxLength={30}
                          className="bg-white/5 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:border-primary w-44"
                          autoFocus
                        />
                        <button onClick={handleSaveUsername} disabled={usernameSaving} className="text-xs bg-primary text-black px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50">
                          {usernameSaving ? "..." : "Save"}
                        </button>
                        <button onClick={() => { setUsernameEditing(false); setUsernameError(null); }} className="text-xs text-on-surface-variant hover:text-on-surface px-2 py-1.5">
                          Cancel
                        </button>
                      </div>
                      <p className="text-[10px] text-on-surface-variant opacity-60 pl-5">Letters, numbers, underscores only · max 30 chars</p>
                      {usernameError && <p className="text-xs text-red-400 pl-5">{usernameError}</p>}
                    </div>
                  ) : (
                    <>
                      <p className="text-on-surface-variant text-sm">
                        {username ? <span className="text-primary/80">@{username}</span> : <span className="italic opacity-50">Set a username</span>}
                      </p>
                      <button
                        onClick={() => { setUsernameDraft(username); setUsernameEditing(true); }}
                        className="text-on-surface-variant hover:text-primary transition-colors"
                        title="Edit username"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      {username && (
                        <span className="text-[10px] text-on-surface-variant opacity-40 hidden md:inline">· /profile/{username}</span>
                      )}
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4 mb-3 justify-center md:justify-start">
                  <p className="text-on-surface-variant text-sm">{user.email}</p>
                  <Link href="/profile/wrapped" className="text-xs bg-gradient-to-r from-[#e9c349] to-[#b38b22] text-black px-3 py-1 rounded-full font-bold shadow-[0_0_15px_rgba(233,195,73,0.3)] hover:scale-105 transition-transform flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">auto_awesome</span> Yearly Wrapped
                  </Link>
                </div>

                {/* Bio row */}
                <div className="mb-5">
                  {bioEditing ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={bioDraft}
                        onChange={e => { setBioDraft(e.target.value); setBioError(null); }}
                        placeholder="Write a short bio..."
                        maxLength={150}
                        rows={3}
                        className="w-full md:max-w-sm bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:border-primary resize-none"
                        autoFocus
                      />
                      <div className="flex items-center gap-3">
                        <span className={`text-xs ${bioDraft.length >= 140 ? 'text-red-400' : 'text-on-surface-variant opacity-50'}`}>{bioDraft.length}/150</span>
                        <button onClick={handleSaveBio} disabled={bioSaving} className="text-xs bg-primary text-black px-4 py-1.5 rounded-lg font-semibold disabled:opacity-50">
                          {bioSaving ? "Saving..." : "Save"}
                        </button>
                        <button onClick={() => { setBioEditing(false); setBioError(null); }} className="text-xs text-on-surface-variant hover:text-on-surface">
                          Cancel
                        </button>
                      </div>
                      {bioError && <p className="text-xs text-red-400">{bioError}</p>}
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 justify-center md:justify-start">
                      <p className={`text-sm max-w-sm leading-relaxed ${bio ? 'text-on-surface-variant' : 'italic text-on-surface-variant opacity-40'}`}>
                        {bio || "Add a bio..."}
                      </p>
                      <button
                        onClick={() => { setBioDraft(bio); setBioEditing(true); }}
                        className="text-on-surface-variant hover:text-primary transition-colors flex-shrink-0 mt-0.5"
                        title="Edit bio"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-center md:justify-start gap-6 flex-wrap">
                  <div className="text-center">
                    <span className="block font-headline-md text-headline-sm text-primary">{watchedCount}</span>
                    <span className="text-label-sm uppercase tracking-widest text-on-surface-variant opacity-60">Watched</span>
                  </div>
                  <div className="h-10 w-px bg-white/10"></div>
                  <div className="text-center">
                    <span className="block font-headline-md text-headline-sm text-primary">{watchlist.length}</span>
                    <span className="text-label-sm uppercase tracking-widest text-on-surface-variant opacity-60">Watchlist</span>
                  </div>
                  <div className="h-10 w-px bg-white/10"></div>
                  <div className="text-center">
                    <span className="block font-headline-md text-headline-sm text-primary">{reviews.length}</span>
                    <span className="text-label-sm uppercase tracking-widest text-on-surface-variant opacity-60">Reviews</span>
                  </div>
                  <div className="h-10 w-px bg-white/10"></div>
                  <button
                    onClick={() => openFollowList("followers")}
                    className="text-center cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-none p-0"
                  >
                    <span className="block font-headline-md text-headline-sm text-primary">{followCounts.followers}</span>
                    <span className="text-label-sm uppercase tracking-widest text-on-surface-variant opacity-60">Followers</span>
                  </button>
                  <div className="h-10 w-px bg-white/10"></div>
                  <button
                    onClick={() => openFollowList("following")}
                    className="text-center cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-none p-0"
                  >
                    <span className="block font-headline-md text-headline-sm text-primary">{followCounts.following}</span>
                    <span className="text-label-sm uppercase tracking-widest text-on-surface-variant opacity-60">Following</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Favorites Sections */}
            <section className="mb-12">
              <h3 className="font-serif text-[#e5e2e1] text-headline-sm uppercase tracking-wider mb-6 border-l-4 border-[#e50914] pl-3">
                My Top 5 Films
              </h3>
              <div className="grid grid-cols-5 gap-3 md:gap-4 mb-10">
                {['movie_1', 'movie_2', 'movie_3', 'movie_4', 'movie_5'].map((slot, index) => {
                  const fav = favorites[slot];
                  return (
                    <div 
                      key={slot}
                      onClick={() => {
                        if (fav) {
                          setOptionsModal({ isOpen: true, slotType: slot, name: fav.name });
                        } else {
                          setSearchModal({ isOpen: true, type: "movie", slotType: slot });
                        }
                      }}
                      className="group aspect-[2/3] rounded-xl overflow-hidden border border-white/10 relative bg-white/5 cursor-pointer hover:border-[#e50914] transition-all duration-300 flex flex-col items-center justify-center"
                    >
                      {fav ? (
                        <>
                          <img
                            src={fav.image_url ? `https://image.tmdb.org/t/p/w500${fav.image_url}` : "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500"}
                            alt={fav.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 justify-center">
                            <span className="text-[10px] text-[#e9c349] uppercase tracking-wider font-bold">Edit Film</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center p-2 text-white/40 group-hover:text-[#e50914] transition-colors">
                          <span className="material-symbols-outlined text-[32px] mb-1">add</span>
                          <span className="text-[10px] uppercase tracking-wider font-bold">Film {index + 1}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <h3 className="font-serif text-[#e5e2e1] text-headline-sm uppercase tracking-wider mb-6 border-l-4 border-[#e9c349] pl-3">
                Favorite Creatives
              </h3>
              <div className="flex flex-wrap justify-start gap-8 md:gap-12 mb-6">
                {[
                  { slot: 'director', label: 'Favorite Director', defaultIcon: 'director_chair' },
                  { slot: 'actor', label: 'Favorite Actor', defaultIcon: 'person' },
                  { slot: 'actress', label: 'Favorite Actress', defaultIcon: 'person' }
                ].map(({ slot, label, defaultIcon }) => {
                  const fav = favorites[slot];
                  return (
                    <div 
                      key={slot}
                      onClick={() => {
                        if (fav) {
                          setOptionsModal({ isOpen: true, slotType: slot, name: fav.name });
                        } else {
                          setSearchModal({ isOpen: true, type: "person", slotType: slot });
                        }
                      }}
                      className="flex flex-col items-center gap-2 group cursor-pointer"
                    >
                      <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border border-white/10 relative bg-white/5 flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:border-[#e9c349]">
                        {fav ? (
                          <>
                            <img
                              src={fav.image_url ? `https://image.tmdb.org/t/p/w342${fav.image_url}` : "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}
                              alt={fav.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="material-symbols-outlined text-white text-[20px]">edit</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-white/40 group-hover:text-[#e9c349] transition-colors">
                            <span className="material-symbols-outlined text-[32px]">add</span>
                          </div>
                        )}
                      </div>
                      <div className="text-center max-w-[120px]">
                        {fav ? (
                          <>
                            <p className="text-body-sm font-bold text-white truncate max-w-[120px] group-hover:text-[#e9c349] transition-colors">{fav.name}</p>
                            <p className="text-[10px] uppercase tracking-wider text-[#e9c349]/70 font-semibold">{label.split(' ')[1]}</p>
                          </>
                        ) : (
                          <p className="text-xs text-on-surface-variant font-bold group-hover:text-white transition-colors">{label}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Navigation Tabs */}
            <div className="flex gap-4 border-b border-white/10 mb-8 pb-2 overflow-x-auto hide-scrollbar">
              <button 
                onClick={() => setActiveTab("watched")}
                className={`pb-2 px-2 font-bold uppercase tracking-widest text-[12px] whitespace-nowrap transition-colors relative border-none bg-transparent cursor-pointer ${activeTab === "watched" ? "text-primary" : "text-on-surface-variant hover:text-white"}`}
              >
                Watched
                {activeTab === "watched" && <div className="absolute bottom-[-10px] left-0 w-full h-0.5 bg-primary shadow-[0_0_8px_rgba(255,180,170,0.8)]"></div>}
              </button>
              <button 
                onClick={() => setActiveTab("watchlist")}
                className={`pb-2 px-2 font-bold uppercase tracking-widest text-[12px] whitespace-nowrap transition-colors relative border-none bg-transparent cursor-pointer ${activeTab === "watchlist" ? "text-primary" : "text-on-surface-variant hover:text-white"}`}
              >
                Watchlist
                {activeTab === "watchlist" && <div className="absolute bottom-[-10px] left-0 w-full h-0.5 bg-primary shadow-[0_0_8px_rgba(255,180,170,0.8)]"></div>}
              </button>
              <button 
                onClick={() => setActiveTab("reviews")}
                className={`pb-2 px-2 font-bold uppercase tracking-widest text-[12px] whitespace-nowrap transition-colors relative border-none bg-transparent cursor-pointer ${activeTab === "reviews" ? "text-primary" : "text-on-surface-variant hover:text-white"}`}
              >
                Reviews
                {activeTab === "reviews" && <div className="absolute bottom-[-10px] left-0 w-full h-0.5 bg-primary shadow-[0_0_8px_rgba(255,180,170,0.8)]"></div>}
              </button>
              <button 
                onClick={() => setActiveTab("stats")}
                className={`pb-2 px-2 font-bold uppercase tracking-widest text-[12px] whitespace-nowrap transition-colors relative border-none bg-transparent cursor-pointer ${activeTab === "stats" ? "text-primary" : "text-on-surface-variant hover:text-white"}`}
              >
                Cinema DNA
                {activeTab === "stats" && <div className="absolute bottom-[-10px] left-0 w-full h-0.5 bg-primary shadow-[0_0_8px_rgba(255,180,170,0.8)]"></div>}
              </button>
            </div>
 
            {/* Tab Content */}
            {activeTab === "watched" && (
              <section className="animate-fade-in">
                {watched.length === 0 ? (
                  <p className="text-on-surface-variant text-center py-10">You haven't marked any movies as watched yet.</p>
                ) : (
                  <>
                    {/* Sort/Filter Bar */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 no-scrollbar scroll-smooth">
                      <span className="text-xs text-on-surface-variant uppercase tracking-widest font-semibold flex items-center gap-1 shrink-0 mr-1 opacity-70">
                        <span className="material-symbols-outlined text-[15px]">sort</span>
                        Sort:
                      </span>
                      {SORT_OPTIONS.map(option => {
                        const isActive = watchedSort === option.id;
                        return (
                          <button
                            key={option.id}
                            onClick={() => setWatchedSort(option.id)}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer border flex items-center gap-1.5 select-none shrink-0 ${
                              isActive
                                ? "bg-[#e50914] text-white border-[#e50914] shadow-[0_0_12px_rgba(229,9,20,0.4)] font-bold scale-[1.02]"
                                : "bg-white/5 text-on-surface-variant border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20"
                            }`}
                          >
                            {isActive && <span className="material-symbols-outlined text-[13px] font-bold">check</span>}
                            {option.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Movie Grid */}
                    <div key={watchedSort} className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-stack-md animate-fade-in">
                      {sortedWatched.map(item => {
                        const movie = movieDetails[item.movie_id] || item;
                        const userRating = ratingsMap[item.movie_id];
                        return (
                          <div key={item.movie_id} className="group relative block">
                            <Link href={`/movies?id=${item.movie_id}`} className="cursor-pointer block relative">
                              <div className="aspect-[2/3] rounded-xl overflow-hidden border border-white/10 relative mb-2 bg-white/5">
                                <img
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                  alt={movie.movie_title || movie.title || "Movie Poster"}
                                  src={(posterPrefs[item.movie_id] ?? movie.poster_path) ? `https://image.tmdb.org/t/p/w500${posterPrefs[item.movie_id] ?? movie.poster_path}` : "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500"}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                                {/* User Rating Overlay */}
                                {userRating !== undefined && (
                                  <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-[#e9c349]/30 shadow-lg">
                                    <span className="text-[#e9c349] text-[11px] leading-none">★</span>
                                    <span className="text-[#e9c349] text-[11px] font-bold leading-none">{userRating % 1 === 0 ? userRating : userRating.toFixed(1)}</span>
                                  </div>
                                )}
                                <div className="absolute bottom-2 left-0 right-0 flex justify-center text-[10px] text-white bg-black/60 backdrop-blur-md px-2 py-1 rounded mx-2 shadow border border-white/10" suppressHydrationWarning>
                                  {new Date(item.watched_at).toLocaleDateString()}
                                </div>
                              </div>
                              <h4 className="text-body-md font-bold truncate group-hover:text-primary transition-colors">{movie.movie_title || movie.title}</h4>
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>
            )}

            {activeTab === "watchlist" && (
              <section className="animate-fade-in">
                {watchlist.length === 0 ? (
                  <p className="text-on-surface-variant text-center py-10">Your watchlist is empty.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-stack-md">
                    {watchlist.map(item => {
                      const movie = movieDetails[item.movie_id] || item;
                      return (
                        <div key={item.movie_id} className="group relative block">
                          <Link href={`/movies?id=${item.movie_id}`} className="cursor-pointer block relative">
                            <div className="aspect-[2/3] rounded-xl overflow-hidden border border-white/10 relative mb-2 bg-white/5">
                              <img
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                alt={movie.movie_title || movie.title || "Movie Poster"}
                                src={(posterPrefs[item.movie_id] ?? movie.poster_path) ? `https://image.tmdb.org/t/p/w500${posterPrefs[item.movie_id] ?? movie.poster_path}` : "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500"}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                            </div>
                            <h4 className="text-body-md font-bold truncate group-hover:text-primary transition-colors">{movie.movie_title || movie.title}</h4>
                          </Link>
                          <button
                            onClick={() => handleRemoveFromWatchlist(item.movie_id)}
                            className="mt-1 w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 py-1.5 rounded-lg text-label-sm font-bold transition-all border border-red-500/20 active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[14px]">delete</span>
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {activeTab === "reviews" && (
              <section className="animate-fade-in max-w-3xl space-y-stack-md">
                {reviews.length === 0 ? (
                  <p className="text-on-surface-variant text-center py-10">You haven't written any reviews yet.</p>
                ) : (
                  reviews.map(review => {
                    const movie = movieDetails[review.movie_id];
                    const rating = ratings.find(r => r.movie_id === review.movie_id)?.rating;
                    const poster = movie?.poster_path || review.poster_path;
                    const isEditing = profileEditReviewId === review.id;

                    return (
                      <ReviewCard
                        key={review.id}
                        review={review}
                        currentUserId={user?.id}
                        currentUserName={user?.name}
                        currentUserAvatar={avatarUrl || user?.image}
                        avatarUrl={avatarUrl || user?.image}
                        userRating={rating}
                        movieTitle={movie?.title || review.movie_title}
                        posterPath={poster}
                        onEdit={() => {
                          setProfileEditReviewId(review.id);
                          setProfileEditText(review.review_text);
                        }}
                        onDelete={handleProfileDeleteReview}
                        isEditing={isEditing}
                        editText={profileEditText}
                        setEditText={setProfileEditText}
                        onSaveEdit={handleProfileSaveEdit}
                        onCancelEdit={() => setProfileEditReviewId(null)}
                        isEditingSubmitting={profileEditSubmitting}
                      />
                    );
                  })
                )}
              </section>
            )}

            {activeTab === "stats" && (
              <section className="animate-fade-in space-y-stack-lg max-w-4xl mx-auto">
                {/* Main Donut & Top Genres Card */}
                <div className="glass-card p-6 md:p-8 rounded-2xl border border-[#e9c349]/30 shadow-[0_8px_32px_rgba(233,195,73,0.08)] bg-gradient-to-br from-[#181818] via-[#121212] to-[#0a0a0a]">
                  <div className="flex items-center gap-2 mb-6">
                    <span className="material-symbols-outlined text-[#e9c349] text-2xl">genetics</span>
                    <h3 className="font-title-lg text-title-lg font-serif text-[#e9c349] uppercase tracking-wider">
                      Cinematic Genome
                    </h3>
                  </div>

                  {cinemaDnaData.topGenres.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                      {/* Left Column: Animated SVG Donut Chart */}
                      <div className="md:col-span-5 flex flex-col items-center justify-center relative py-2">
                        <div className="relative w-48 h-48 flex items-center justify-center">
                          <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                            <circle
                              cx="50"
                              cy="50"
                              r="38"
                              fill="none"
                              stroke="rgba(255, 255, 255, 0.05)"
                              strokeWidth="10"
                            />
                            {(() => {
                              const circumference = 2 * Math.PI * 38;
                              let accumulatedOffset = 0;
                              return cinemaDnaData.topGenres.map((g) => {
                                const sliceLength = (g.percentage / 100) * circumference;
                                const dashArray = `${sliceLength} ${circumference - sliceLength}`;
                                const dashOffset = -accumulatedOffset;
                                accumulatedOffset += sliceLength;

                                return (
                                  <circle
                                    key={g.name}
                                    cx="50"
                                    cy="50"
                                    r="38"
                                    fill="none"
                                    stroke={g.color}
                                    strokeWidth="10"
                                    strokeDasharray={dashArray}
                                    strokeDashoffset={dashOffset}
                                    className="transition-all duration-700 ease-out"
                                  />
                                );
                              });
                            })()}
                          </svg>
                          
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-bold text-[#e9c349] uppercase tracking-widest">Cinema</span>
                            <span className="text-xl font-serif font-bold text-white tracking-tighter">DNA</span>
                            <span className="text-[10px] text-on-surface-variant opacity-70 mt-0.5">{watched.length} Watched</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Top 5 Genres List */}
                      <div className="md:col-span-7 space-y-3.5">
                        <h4 className="text-xs uppercase tracking-widest text-on-surface-variant font-semibold mb-3">
                          Top 5 Genres Breakdown
                        </h4>
                        {cinemaDnaData.topGenres.map((g) => (
                          <div key={g.name} className="space-y-1">
                            <div className="flex justify-between items-center text-xs font-semibold">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: g.color }}></span>
                                <span>{g.name}</span>
                              </div>
                              <span className="text-[#e9c349] font-bold">{g.percentage}%</span>
                            </div>
                            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${g.percentage}%`, backgroundColor: g.color }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-on-surface-variant text-center py-8">
                      Mark movies as watched to generate your Cinema DNA chart.
                    </p>
                  )}
                </div>

                {/* Bottom 3 Stat Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-stack-lg">
                  {/* Card 1: Your Cinema Era */}
                  <div className="glass-card p-6 rounded-2xl border border-white/10 hover:border-[#e9c349]/40 transition-all flex flex-col justify-between space-y-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <span className="material-symbols-outlined text-6xl text-[#e9c349]">history_edu</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                      <span className="material-symbols-outlined text-[#e9c349] text-lg">movie_filter</span>
                      Your Cinema Era
                    </div>
                    <div>
                      <div className="text-2xl md:text-3xl font-serif font-bold text-[#e9c349] mb-1">
                        {cinemaDnaData.topDecade}
                      </div>
                      <p className="text-xs text-on-surface-variant opacity-80">
                        {cinemaDnaData.decadePercent}% of films you watch are from the {cinemaDnaData.topDecade}
                      </p>
                    </div>
                    <div className="w-full h-1 bg-gradient-to-r from-[#e9c349] to-transparent rounded-full"></div>
                  </div>

                  {/* Card 2: Average Rating Given */}
                  <div className="glass-card p-6 rounded-2xl border border-white/10 hover:border-[#e9c349]/40 transition-all flex flex-col justify-between space-y-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <span className="material-symbols-outlined text-6xl text-[#e9c349]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                      <span className="material-symbols-outlined text-[#e9c349] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      Average Rating Given
                    </div>
                    <div>
                      <div className="flex items-baseline gap-1 text-2xl md:text-3xl font-serif font-bold text-white mb-1">
                        <span className="text-[#e9c349]">{cinemaDnaData.avgRatingVal}</span>
                        <span className="text-xs text-on-surface-variant font-normal">/ 10</span>
                      </div>
                      <p className="text-xs text-on-surface-variant opacity-80">
                        Across {ratings.length} rated movies in your journal
                      </p>
                    </div>
                    <div className="w-full h-1 bg-gradient-to-r from-[#e9c349] to-transparent rounded-full"></div>
                  </div>

                  {/* Card 3: Total Watch Time */}
                  <div className="glass-card p-6 rounded-2xl border border-white/10 hover:border-[#e9c349]/40 transition-all flex flex-col justify-between space-y-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <span className="material-symbols-outlined text-6xl text-[#e9c349]">schedule</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                      <span className="material-symbols-outlined text-[#e9c349] text-lg">timer</span>
                      Total Watch Time
                    </div>
                    <div>
                      <div className="text-2xl md:text-3xl font-serif font-bold text-white mb-1">
                        {cinemaDnaData.formattedRuntime}
                      </div>
                      <p className="text-xs text-on-surface-variant opacity-80">
                        Calculated from {watched.length} watched film runtimes
                      </p>
                    </div>
                    <div className="w-full h-1 bg-gradient-to-r from-[#e9c349] to-transparent rounded-full"></div>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-[60px] z-50 mb-container-margin mx-container-margin rounded-full bg-surface/40 backdrop-blur-[100px] border border-white/10 flex justify-around items-center px-6 shadow-[0_0_20px_rgba(255,180,170,0.1)] max-w-md md:left-1/2 md:-translate-x-1/2">
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/"><span className="material-symbols-outlined">home</span></Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/recommendations"><span className="material-symbols-outlined">search</span></Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/movies"><span className="material-symbols-outlined">bookmark</span></Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/community"><span className="material-symbols-outlined">group</span></Link>
        <Link className="flex items-center justify-center text-primary relative after:content-[''] after:absolute after:-bottom-2 after:w-1 after:h-1 after:bg-primary after:rounded-full after:shadow-[0_0_8px_#ffb4aa] active:scale-90" href="/profile"><span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>person</span></Link>
      </nav>

      {/* Search Modal */}
      {searchModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-lg p-6 max-h-[85vh] flex flex-col relative shadow-[0_10px_50px_rgba(229,9,20,0.15)]">
            <button 
              onClick={() => {
                setSearchModal(null);
                setSearchQuery("");
                setSearchResults([]);
              }}
              className="absolute top-4 right-4 text-white/60 hover:text-white cursor-pointer transition-colors bg-transparent border-none outline-none flex items-center"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>

            <h3 className="font-serif text-headline-sm text-white mb-1">
              {searchModal.type === "movie" ? "Search Films" : "Search Creatives"}
            </h3>
            <p className="text-on-surface-variant text-label-md mb-4 uppercase tracking-widest text-[#e9c349] font-bold">
              {searchModal.slotType.replace('_', ' ')}
            </p>

            <div className="relative">
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchModal.type === "movie" ? "Search for a movie (e.g. Inception)..." : "Search for a person (e.g. Christopher Nolan)..."}
                className="w-full bg-white/5 border border-white/10 rounded-full px-5 py-3 text-body-md text-white placeholder-white/30 focus:outline-none focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914] transition-all"
              />
            </div>

            <div className="flex-grow overflow-y-auto mt-4 space-y-2 pr-1 no-scrollbar">
              {searching ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-3">
                  <div className="h-8 w-8 border-2 border-[#e50914] border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs text-on-surface-variant uppercase tracking-widest">Searching CineVerse...</span>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-10 text-on-surface-variant text-body-md">
                  {searchQuery.trim() ? "No results found." : "Type above to begin searching..."}
                </div>
              ) : (
                searchResults.map((item) => {
                  const imagePath = searchModal.type === "movie" ? item.poster_path : item.profile_path;
                  const title = item.title || item.name;
                  const subtitle = searchModal.type === "movie" 
                    ? (item.release_date ? new Date(item.release_date).getFullYear() : "N/A")
                    : (item.known_for_department || "Department unknown");

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSaveFavorite(item)}
                      className="flex items-center gap-4 p-2.5 rounded-xl border border-transparent hover:border-[#e50914]/30 hover:bg-[#e50914]/5 cursor-pointer transition-all duration-300 group"
                    >
                      <div className={`w-12 h-16 bg-white/5 rounded overflow-hidden flex-shrink-0 border border-white/10 ${searchModal.type === "person" ? "rounded-full h-12 w-12" : ""}`}>
                        <img
                          src={imagePath ? `https://image.tmdb.org/t/p/w185${imagePath}` : "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=185"}
                          alt={title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-grow min-w-0">
                        <h4 className="font-bold text-body-md text-white group-hover:text-primary transition-colors truncate">{title}</h4>
                        <p className="text-xs text-on-surface-variant opacity-75 truncate">{subtitle}</p>
                      </div>
                      <span className="material-symbols-outlined text-white/20 group-hover:text-[#e50914] transition-colors">
                        add_circle
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Options Modal */}
      {optionsModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-[5px] animate-fade-in">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-sm p-6 text-center shadow-[0_10px_50px_rgba(0,0,0,0.5)]">
            <h3 className="font-serif text-headline-sm text-white mb-2">Manage Favorite</h3>
            <p className="text-on-surface-variant text-body-md mb-6">
              What would you like to do with <span className="text-[#e9c349] font-bold">{optionsModal.name}</span>?
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  const type = ['movie_1', 'movie_2', 'movie_3', 'movie_4', 'movie_5'].includes(optionsModal.slotType) ? "movie" : "person";
                  setSearchModal({ isOpen: true, type, slotType: optionsModal.slotType });
                  setOptionsModal(null);
                }}
                className="w-full bg-white text-black font-bold py-3 rounded-full hover:bg-white/95 active:scale-98 transition-all cursor-pointer text-body-md"
              >
                Replace Item
              </button>
              <button
                onClick={() => handleRemoveFavorite(optionsModal.slotType)}
                className="w-full bg-[#e50914] text-white font-bold py-3 rounded-full hover:bg-[#e50914]/90 active:scale-98 transition-all cursor-pointer text-body-md"
              >
                Remove Item
              </button>
              <button
                onClick={() => setOptionsModal(null)}
                className="w-full bg-white/5 border border-white/10 text-white font-bold py-3 rounded-full hover:bg-white/10 active:scale-98 transition-all cursor-pointer text-body-md"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Follow List Modal */}
      {followListModal && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setFollowListModal(null)}
        >
          <div
            className="bg-[#131313] border border-white/10 rounded-t-3xl w-full max-w-md max-h-[75vh] overflow-hidden flex flex-col shadow-[0_-8px_40px_rgba(0,0,0,0.6)]"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h3 className="font-serif text-lg text-on-surface capitalize">
                {followListModal.type === "followers" ? `${followCounts.followers} Followers` : `${followCounts.following} Following`}
              </h3>
              <button onClick={() => setFollowListModal(null)} className="text-on-surface-variant hover:text-white transition-colors cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 py-2">
              {followListModal.loading ? (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : followListModal.users.length === 0 ? (
                <div className="text-center py-12">
                  <span className="material-symbols-outlined text-[40px] text-on-surface-variant/30 mb-3">{followListModal.type === "followers" ? "group" : "person_add"}</span>
                  <p className="text-on-surface-variant text-sm">
                    {followListModal.type === "followers" ? "No followers yet" : "Not following anyone yet"}
                  </p>
                </div>
              ) : (
                followListModal.users.map((u: any) => (
                  <Link
                    key={u.user_id}
                    href={`/profile/${u.user_id}`}
                    onClick={() => setFollowListModal(null)}
                    className="flex items-center gap-4 px-6 py-3 hover:bg-white/5 transition-colors"
                  >
                    {getSafeAvatarUrl(u.avatar_url) ? (
                      <img src={getSafeAvatarUrl(u.avatar_url)!} alt={u.display_name} className="w-11 h-11 rounded-full object-cover border border-white/10 flex-shrink-0" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-primary/20 border border-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary font-bold text-sm">{(u.display_name || u.username || "?").slice(0, 2).toUpperCase()}</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-on-surface truncate">{u.display_name || u.username || "Cine Member"}</p>
                      {u.username && <p className="text-xs text-on-surface-variant truncate">@{u.username}</p>}
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant/40 text-sm flex-shrink-0">chevron_right</span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Avatar Full-Screen Modal */}
      {avatarModalOpen && (
        <div
          className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl animate-fade-in"
          onClick={() => setAvatarModalOpen(false)}
        >
          {/* Close button */}
          <button
            className="absolute top-5 right-5 text-white/60 hover:text-white transition-colors"
            onClick={() => setAvatarModalOpen(false)}
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[32px]">close</span>
          </button>

          {/* Enlarged Avatar */}
          <div
            className="w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden border-4 border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.9)] mb-8"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={getAvatarUrlOrDefault(avatarUrl || user?.image)}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Edit Photo Button */}
          <label
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-6 py-3 rounded-full cursor-pointer transition-all duration-200 text-sm"
            onClick={e => e.stopPropagation()}
          >
            {uploading ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">photo_camera</span>
                <span>Edit Photo</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={async (e) => {
                await handleAvatarUpload(e);
                setAvatarModalOpen(false);
              }}
            />
          </label>
          <p className="mt-3 text-white/30 text-xs">Click outside to close</p>
        </div>
      )}
    </div>
  );
}
