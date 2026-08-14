"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProvider";
import NotificationBell from "@/components/NotificationBell";
import { getSafeAvatarUrl } from "@/lib/avatar";

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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function TasteMatchWidget({ userA, userB }: { userA: string; userB: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/taste-match?userA=${userA}&userB=${userB}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [userA, userB]);

  if (loading) {
    return (
      <div className="glass-card rounded-xl border border-white/10 p-5 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/3 mb-3"></div>
        <div className="h-8 bg-white/10 rounded w-1/2"></div>
      </div>
    );
  }

  if (!data) return null;

  const getMatchColor = (pct: number) => {
    if (pct >= 75) return "text-green-400";
    if (pct >= 55) return "text-primary";
    return "text-on-surface-variant";
  };

  const getArcColor = (pct: number) => {
    if (pct >= 75) return "#4ade80";
    if (pct >= 55) return "#ffb4aa";
    return "#6b7280";
  };

  if (data.noOverlap) {
    return (
      <div className="glass-card rounded-xl border border-white/10 p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-on-surface-variant text-sm">compare_arrows</span>
          <h3 className="text-xs text-on-surface-variant uppercase tracking-widest font-semibold">Taste Match</h3>
        </div>
        <p className="text-on-surface-variant text-sm italic">Not enough shared ratings yet — rate some movies to compare tastes.</p>
      </div>
    );
  }

  const { percentage, label, sharedCount } = data;
  const radius = 36;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (percentage / 100) * circ;

  return (
    <div className="glass-card rounded-xl border border-white/10 p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-primary text-sm">compare_arrows</span>
        <h3 className="text-xs text-on-surface-variant uppercase tracking-widest font-semibold">Taste Match</h3>
      </div>
      <div className="flex items-center gap-5">
        {/* SVG Arc */}
        <div className="relative flex-shrink-0">
          <svg width="88" height="88" viewBox="0 0 88 88">
            <circle cx="44" cy="44" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
            <circle
              cx="44" cy="44" r={radius} fill="none"
              stroke={getArcColor(percentage)} strokeWidth="8"
              strokeDasharray={circ} strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 44 44)"
              style={{ transition: "stroke-dashoffset 1s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-xl font-bold font-serif ${getMatchColor(percentage)}`}>{percentage}%</span>
          </div>
        </div>
        <div>
          <p className={`font-bold text-lg font-serif ${getMatchColor(percentage)}`}>{label}</p>
          <p className="text-on-surface-variant text-xs mt-1">Based on {sharedCount} shared {sharedCount === 1 ? "rating" : "ratings"}</p>
        </div>
      </div>
    </div>
  );
}

export default function PublicProfilePage({ params }: { params: { userId: string } }) {
  const { data: session } = useSession();
  const currentUser = session?.user as any;
  const targetUserId = params.userId;
  const { showToast } = useToast();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [reviews, setReviews] = useState<any[]>([]);
  const [movieDetails, setMovieDetails] = useState<Record<string, any>>({});
  const [watchCount, setWatchCount] = useState(0);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [watchedMovies, setWatchedMovies] = useState<any[]>([]);
  const [watchedSort, setWatchedSort] = useState<SortOption>("default");
  const [followListModal, setFollowListModal] = useState<{ type: "followers" | "following"; users: any[]; loading: boolean } | null>(null);

  const isOwnProfile = currentUser?.id === targetUserId;

  // Avatar modal
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);

  // Cinematic Profile Banner State
  const [bannerBackdropUrl, setBannerBackdropUrl] = useState<string | null>(null);
  const [bannerMovieTitle, setBannerMovieTitle] = useState<string | null>(null);

  // Fetch TMDB backdrop_path for Film 1 in Top 5
  useEffect(() => {
    const film1 = favorites.find((f: any) => f.slot_type === "movie_1");
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
    async function loadAll() {
      setLoading(true);
      try {
        // Detect whether slug is a UUID or a username
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId);
        const profileUrl = isUUID
          ? `/api/user-profile?userId=${targetUserId}`
          : `/api/user-profile?username=${encodeURIComponent(targetUserId)}`;
        const pRes = await fetch(profileUrl);
        if (!pRes.ok) { setProfile(null); setLoading(false); return; }
        const profileData = await pRes.json();
        setProfile(profileData);
        // Resolve real userId for all subsequent queries
        const realUserId = profileData.user_id;

        // Follow status and counts in parallel
        const [followStatusRes, followCountsRes, reviewsRes, watchedRes, watchlistRes, watchedListRes, favoritesRes] = await Promise.all([
          currentUser?.id && !isOwnProfile
            ? fetch(`/api/follows?followerId=${currentUser.id}&followingId=${realUserId}`).then((r) => r.json())
            : Promise.resolve(null),
          fetch(`/api/follows?userId=${realUserId}`).then((r) => r.json()),
          supabase.from("reviews").select("*").eq("user_id", realUserId).order("created_at", { ascending: false }).limit(5),
          supabase.from("watched").select("id", { count: "exact" }).eq("user_id", realUserId),
          supabase.from("watchlist").select("id", { count: "exact" }).eq("user_id", realUserId),
          supabase.from("watched").select("movie_id, poster_path, movie_title, watched_at").eq("user_id", realUserId).order("watched_at", { ascending: false }).limit(30),
          fetch(`/api/favorites?userId=${realUserId}`).then(r => r.ok ? r.json() : []),
        ]);

        if (followStatusRes) setFollowing(followStatusRes.isFollowing);
        setFollowCounts({ followers: followCountsRes.followerCount || 0, following: followCountsRes.followingCount || 0 });
        setWatchCount(watchedRes.count || 0);
        setWatchlistCount(watchlistRes.count || 0);

        const revs = reviewsRes.data || [];
        setReviews(revs);
        setReviewCount(revs.length);

        // Watched movies grid
        const watchedList = watchedListRes.data || [];
        setWatchedMovies(watchedList);

        // Favorites — map slot_type → fav
        const favsArray = Array.isArray(favoritesRes) ? favoritesRes : [];
        setFavorites(favsArray);

        // Fetch movie details for reviews AND watched grid
        const ids = Array.from(new Set([
          ...revs.map((r: any) => r.movie_id),
          ...watchedList.map((w: any) => w.movie_id),
        ]));
        const det: Record<string, any> = {};
        await Promise.all(ids.map(async (id: any) => {
          try {
            const r = await fetch(`/api/tmdb?endpoint=movie/${id}`);
            if (r.ok) det[id] = await r.json();
          } catch {}
        }));
        setMovieDetails(det);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, [targetUserId, currentUser?.id]);

  const toggleFollow = async () => {
    if (!currentUser?.id || isOwnProfile) return;
    setFollowLoading(true);
    if (following) {
      await fetch(`/api/follows?followerId=${currentUser.id}&followingId=${targetUserId}`, { method: "DELETE" });
      setFollowing(false);
      setFollowCounts((prev) => ({ ...prev, followers: prev.followers - 1 }));
      showToast("Unfollowed");
    } else {
      await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          follower_id: currentUser.id,
          following_id: targetUserId,
          follower_name: currentUser.name || currentUser.email || "Someone",
          follower_avatar: currentUser.image || null,
        }),
      });
      setFollowing(true);
      setFollowCounts((prev) => ({ ...prev, followers: prev.followers + 1 }));
      showToast("Following user");
    }
    setFollowLoading(false);
  };

  const openFollowList = async (type: "followers" | "following") => {
    setFollowListModal({ type, users: [], loading: true });
    try {
      const res = await fetch(`/api/follows?userId=${targetUserId}`);
      const data = await res.json();
      const ids: string[] = type === "followers" ? (data.followers || []) : (data.following || []);
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

const UserProfileSkeleton = () => (
  <div className="min-h-screen bg-[#050505] text-[#e5e2e1] pt-[80px] px-6 max-w-2xl mx-auto space-y-8 animate-skeleton-pulse">
    {/* Profile Header Skeleton */}
    <div className="flex flex-col items-center text-center space-y-4 py-6">
      <div className="w-24 h-24 rounded-full bg-white/10 border-2 border-white/10 animate-skeleton-pulse"></div>
      <div className="h-7 bg-white/15 rounded-md w-40 animate-skeleton-pulse"></div>
      <div className="h-4 bg-white/10 rounded-md w-28 animate-skeleton-pulse"></div>
      
      {/* Stats Skeleton */}
      <div className="flex justify-center gap-6 pt-2">
        <div className="text-center space-y-1">
          <div className="h-6 bg-white/15 rounded w-10 mx-auto animate-skeleton-pulse"></div>
          <div className="h-3 bg-white/10 rounded w-14 animate-skeleton-pulse"></div>
        </div>
        <div className="h-8 w-px bg-white/10"></div>
        <div className="text-center space-y-1">
          <div className="h-6 bg-white/15 rounded w-10 mx-auto animate-skeleton-pulse"></div>
          <div className="h-3 bg-white/10 rounded w-14 animate-skeleton-pulse"></div>
        </div>
        <div className="h-8 w-px bg-white/10"></div>
        <div className="text-center space-y-1">
          <div className="h-6 bg-white/15 rounded w-10 mx-auto animate-skeleton-pulse"></div>
          <div className="h-3 bg-white/10 rounded w-14 animate-skeleton-pulse"></div>
        </div>
      </div>
    </div>

    {/* Watched Grid Skeleton */}
    <div className="space-y-4 pt-4">
      <div className="h-4 bg-white/10 rounded w-32 animate-skeleton-pulse"></div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] rounded-xl bg-white/10 border border-white/5 animate-skeleton-pulse"></div>
        ))}
      </div>
    </div>
  </div>
);

  if (loading) {
    return <UserProfileSkeleton />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#050505] text-[#e5e2e1] flex flex-col items-center justify-center gap-4">
        <span className="material-symbols-outlined text-[48px] text-on-surface-variant">person_off</span>
        <h1 className="font-serif text-2xl">User Not Found</h1>
        <Link href="/community" className="text-primary hover:underline text-sm">← Back to Community</Link>
      </div>
    );
  }

  const displayName = profile.display_name || profile.username || "Cine Member";
  const initials = displayName.slice(0, 2).toUpperCase();

  const sortedWatched = useMemo(() => {
    if (!watchedMovies || watchedMovies.length === 0) return [];
    const list = [...watchedMovies];

    return list.sort((a, b) => {
      if (watchedSort === "rating_desc" || watchedSort === "rating_asc") {
        const ratingA = movieDetails[a.movie_id]?.vote_average ?? 0;
        const ratingB = movieDetails[b.movie_id]?.vote_average ?? 0;
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
        const titleA = String(movieA.title || movieA.movie_title || "").toLowerCase();
        const titleB = String(movieB.title || movieB.movie_title || "").toLowerCase();
        const comp = titleA.localeCompare(titleB);
        if (comp !== 0) return comp;
      }

      const timeA = a.watched_at ? new Date(a.watched_at).getTime() : 0;
      const timeB = b.watched_at ? new Date(b.watched_at).getTime() : 0;
      return timeB - timeA;
    });
  }, [watchedMovies, watchedSort, movieDetails]);

  return (
    <div className="font-body-md text-body-md bg-[#050505] text-[#e5e2e1] min-h-screen pb-32">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-50 bg-[#131313]/60 backdrop-blur-[40px] border-b border-white/10 flex justify-between items-center px-6 py-4 shadow-[0_8px_32px_0_rgba(255,180,170,0.05)]">
        <Link href="/community" className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          <span className="text-sm">Social</span>
        </Link>
        <h1 className="font-serif text-lg text-primary tracking-tight">{displayName}</h1>
        <div className="w-16" />
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

      <main className="-mt-20 sm:-mt-24 md:-mt-32 relative z-20 px-6 max-w-2xl mx-auto">
        {/* Profile Header */}
        <section className="flex flex-col items-center text-center pb-8 pt-2 relative">
          {/* Avatar */}
          <button
            className="w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden border-4 border-[#050505] shadow-[0_12px_40px_rgba(0,0,0,0.85)] mb-4 relative z-10 bg-[#131313] cursor-pointer group focus:outline-none"
            onClick={() => setAvatarModalOpen(true)}
            aria-label="View profile picture"
          >
            {getSafeAvatarUrl(profile.avatar_url) ? (
              <img src={getSafeAvatarUrl(profile.avatar_url)!} alt={displayName} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
            ) : (
              <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                <span className="text-primary font-bold text-3xl font-serif">{initials}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
              <span className="material-symbols-outlined text-white text-2xl">zoom_in</span>
            </div>
          </button>

          <h2 className="font-serif text-2xl font-bold text-on-surface mb-1">{displayName}</h2>
          {profile.username && (
            <p className="text-primary/70 text-sm mb-1">@{profile.username}</p>
          )}
          {profile.bio && (
            <p className="text-on-surface-variant text-sm max-w-xs leading-relaxed mb-4">{profile.bio}</p>
          )}

          {/* Stats row */}
          <div className="flex flex-wrap gap-6 justify-center mb-5">
            <div className="text-center">
              <p className="font-bold text-lg text-on-surface">{watchCount}</p>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide">Watched</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-lg text-on-surface">{watchlistCount}</p>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide">Watchlist</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-lg text-on-surface">{reviewCount}</p>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide">Reviews</p>
            </div>
            <button
              onClick={() => openFollowList("followers")}
              className="text-center cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-none p-0"
            >
              <p className="font-bold text-lg text-on-surface">{followCounts.followers}</p>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide">Followers</p>
            </button>
            <button
              onClick={() => openFollowList("following")}
              className="text-center cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-none p-0"
            >
              <p className="font-bold text-lg text-on-surface">{followCounts.following}</p>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide">Following</p>
            </button>
          </div>

          {/* Follow button */}
          {!isOwnProfile && currentUser && following !== null && (
            <button
              onClick={toggleFollow}
              disabled={followLoading}
              className={`px-8 py-2.5 rounded-full font-semibold text-sm transition-all duration-200 cursor-pointer border ${
                following
                  ? "border-white/20 text-on-surface-variant hover:border-red-400/40 hover:text-red-400"
                  : "bg-primary text-black border-primary hover:opacity-90 shadow-[0_0_20px_rgba(255,180,170,0.3)]"
              } disabled:opacity-50`}
            >
              {followLoading ? "..." : following ? "Following ✓" : "Follow"}
            </button>
          )}
          {isOwnProfile && (
            <Link href="/profile" className="px-6 py-2 rounded-full border border-white/20 text-on-surface-variant text-sm hover:border-primary/40 transition-colors">
              Edit Profile
            </Link>
          )}
        </section>

        {/* Taste Match */}
        {!isOwnProfile && currentUser && (
          <div className="mb-6">
            <TasteMatchWidget userA={currentUser.id} userB={targetUserId} />
          </div>
        )}

        {/* Top 5 Favourite Films */}
        {favorites.filter(f => f.slot_type?.startsWith("movie_")).length > 0 && (
          <section className="mb-8">
            <h3 className="text-xs text-on-surface-variant uppercase tracking-widest mb-4">Top 5 Favourite Films</h3>
            <div className="grid grid-cols-5 gap-2">
              {["movie_1", "movie_2", "movie_3", "movie_4", "movie_5"].map(slot => {
                const fav = favorites.find(f => f.slot_type === slot);
                if (!fav) return (
                  <div key={slot} className="aspect-[2/3] rounded-xl bg-white/5 border border-white/5 flex items-center justify-center">
                    <span className="material-symbols-outlined text-on-surface-variant/20 text-[20px]">movie</span>
                  </div>
                );
                return (
                  <div key={slot} className="aspect-[2/3] rounded-xl overflow-hidden border border-white/10 group relative" title={fav.name}>
                    <img
                      src={fav.image_url ? `https://image.tmdb.org/t/p/w342${fav.image_url}` : "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=342"}
                      alt={fav.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                      <p className="text-[9px] text-white font-bold line-clamp-2 leading-tight">{fav.name}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Recent Reviews */}
        {reviews.length > 0 && (
          <section>
            <h3 className="text-xs text-on-surface-variant uppercase tracking-widest mb-4">Recent Reviews</h3>
            <div className="space-y-4">
              {reviews.map((rev) => {
                const movie = movieDetails[rev.movie_id];
                return (
                  <div key={rev.id} className="glass-card p-5 rounded-xl border border-white/10">
                    <div className="flex gap-4">
                      {movie && (
                        <Link href={`/movies?id=${movie.id}`} className="w-14 flex-shrink-0">
                          <div className="aspect-[2/3] rounded-lg overflow-hidden border border-white/5">
                            <img
                              className="w-full h-full object-cover"
                              alt={movie.title}
                              src={movie.poster_path ? `https://image.tmdb.org/t/p/w185${movie.poster_path}` : "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=185"}
                            />
                          </div>
                        </Link>
                      )}
                      <div className="flex-grow">
                        {movie && <p className="font-semibold text-on-surface text-sm mb-1">{movie.title}</p>}
                        <p className="text-on-surface-variant italic text-sm line-clamp-3">&ldquo;{rev.review_text}&rdquo;</p>
                        <p className="text-[10px] text-on-surface-variant opacity-40 mt-2">{timeAgo(rev.created_at)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {reviews.length === 0 && !loading && (
          <div className="text-center py-8 text-on-surface-variant">
            <span className="material-symbols-outlined text-[36px] opacity-30 mb-2">rate_review</span>
            <p className="text-sm">No reviews yet.</p>
          </div>
        )}

        {/* Watched Movies Grid */}
        {watchedMovies.length > 0 && (
          <section className="mt-8">
            <h3 className="text-xs text-on-surface-variant uppercase tracking-widest mb-3">Recently Watched</h3>
            
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
                    className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer border flex items-center gap-1.5 select-none shrink-0 ${
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

            <div key={watchedSort} className="grid grid-cols-3 gap-2 animate-fade-in">
              {sortedWatched.map(item => {
                const movie = movieDetails[item.movie_id];
                const poster = movie?.poster_path || item.poster_path;
                return (
                  <Link key={item.movie_id} href={`/movies?id=${item.movie_id}`} className="group aspect-[2/3] rounded-xl overflow-hidden border border-white/10 relative bg-white/5 block">
                    <img
                      src={poster ? `https://image.tmdb.org/t/p/w342${poster}` : "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=342"}
                      alt={movie?.title || item.movie_title || ""}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                      <p className="text-[10px] text-white font-bold line-clamp-2 leading-tight">{movie?.title || item.movie_title}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-[60px] z-50 mb-4 mx-4 rounded-full bg-surface/40 backdrop-blur-[100px] border border-white/10 flex justify-around items-center px-6 shadow-[0_0_20px_rgba(255,180,170,0.1)] max-w-md md:left-1/2 md:-translate-x-1/2">
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/"><span className="material-symbols-outlined">home</span></Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/recommendations"><span className="material-symbols-outlined">search</span></Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/movies"><span className="material-symbols-outlined">bookmark</span></Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/community"><span className="material-symbols-outlined">group</span></Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/profile"><span className="material-symbols-outlined">person</span></Link>
      </nav>

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
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h3 className="font-serif text-lg text-on-surface capitalize">
                {followListModal.type === "followers" ? `${followCounts.followers} Followers` : `${followCounts.following} Following`}
              </h3>
              <button onClick={() => setFollowListModal(null)} className="text-on-surface-variant hover:text-white transition-colors cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
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
          <button
            className="absolute top-5 right-5 text-white/60 hover:text-white transition-colors"
            onClick={() => setAvatarModalOpen(false)}
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[32px]">close</span>
          </button>

          <div
            className="w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden border-4 border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.9)] mb-8"
            onClick={e => e.stopPropagation()}
          >
            {getSafeAvatarUrl(profile?.avatar_url) ? (
              <img src={getSafeAvatarUrl(profile.avatar_url)!} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                <span className="text-primary font-bold text-5xl font-serif">{initials}</span>
              </div>
            )}
          </div>

          {isOwnProfile && (
            <Link
              href="/profile"
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-6 py-3 rounded-full transition-all duration-200 text-sm"
              onClick={e => e.stopPropagation()}
            >
              <span className="material-symbols-outlined text-sm">edit</span>
              Edit Profile
            </Link>
          )}
          <p className="mt-3 text-white/30 text-xs">Click outside to close</p>
        </div>
      )}
    </div>
  );
}

