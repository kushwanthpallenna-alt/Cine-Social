"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProvider";
import { useAuthPrompt } from "@/components/AuthPromptProvider";
import { getSafeAvatarUrl } from "@/lib/avatar";
import ProfileBadges from "@/components/ProfileBadges";
import ReviewCard from "@/components/ReviewCard";
import NotificationBell from "@/components/NotificationBell";
import RatingDistributionChart from "@/components/RatingDistributionChart";
import { getPosterUrl } from "@/lib/poster";
import { getMovieUrl, getTvUrl } from "@/lib/slug";
import { isAnimeShow } from "@/lib/anime";

type SortOption =
  | "default"
  | "my_rating_desc"
  | "my_rating_asc"
  | "rating_desc"
  | "rating_asc"
  | "runtime_desc"
  | "runtime_asc"
  | "tmdb_desc"
  | "tmdb_asc"
  | "year_desc"
  | "year_asc"
  | "title_asc"
  | "date_added_desc"
  | "date_added_asc";

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
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};

const GENRE_LIST = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Thriller",
  "War",
  "Western",
];

const BASE_SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: "default", label: "Default" },
  { id: "my_rating_desc", label: "My Rating (Highest)" },
  { id: "my_rating_asc", label: "My Rating (Lowest)" },
  { id: "rating_desc", label: "Rating (Highest)" },
  { id: "rating_asc", label: "Rating (Lowest)" },
  { id: "runtime_desc", label: "Runtime (Longest)" },
  { id: "runtime_asc", label: "Runtime (Shortest)" },
  { id: "tmdb_desc", label: "TMDB Rating (Highest)" },
  { id: "tmdb_asc", label: "TMDB Rating (Lowest)" },
  { id: "year_desc", label: "Release Year (Newest)" },
  { id: "year_asc", label: "Release Year (Oldest)" },
  { id: "title_asc", label: "Title (A-Z)" },
  { id: "date_added_desc", label: "Date Added (Newest)" },
  { id: "date_added_asc", label: "Date Added (Oldest)" },
];

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
        <p className="text-on-surface-variant text-sm italic">Not enough shared ratings yet — rate some movies or TV shows to compare tastes.</p>
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

function UserProfileSkeleton() {
  return (
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
}

export default function PublicProfilePage() {
  const router = useRouter();
  const routeParams = useParams();
  const targetUserId =
    (routeParams?.username as string) ||
    (routeParams?.userId as string) ||
    "";

  const { data: session } = useSession();
  const currentUser = session?.user as any;
  const { showToast } = useToast();
  const { showAuthPrompt } = useAuthPrompt();

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
      router.push("/community");
    }
  };

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [reviews, setReviews] = useState<any[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);
  const [myRatings, setMyRatings] = useState<any[]>([]);
  const [mediaDetails, setMediaDetails] = useState<Record<string, any>>({});
  const [watchItems, setWatchItems] = useState<any[]>([]);
  const [watchlistItems, setWatchlistItems] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [watchedSort, setWatchedSort] = useState<SortOption>("default");
  const [watchlistSort, setWatchlistSort] = useState<SortOption>("default");
  const [mediaFilter, setMediaFilter] = useState<"movie" | "tv">("movie");
  const [watchlistMediaFilter, setWatchlistMediaFilter] = useState<"movie" | "tv">("movie");
  const [tvSubFilter, setTvSubFilter] = useState<"all" | "anime" | "others">("all");
  const [followListModal, setFollowListModal] = useState<{ type: "followers" | "following"; users: any[]; loading: boolean } | null>(null);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [bannerBackdropUrl, setBannerBackdropUrl] = useState<string | null>(null);
  const [bannerMovieTitle, setBannerMovieTitle] = useState<string | null>(null);
  const [publicLists, setPublicLists] = useState<any[]>([]);
  const [posterPrefs, setPosterPrefs] = useState<Record<string, string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(`cinesocial_poster_prefs_${targetUserId}`);
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return {};
  });
  const [rewatchCounts, setRewatchCounts] = useState<Record<string, number>>({});

  // Tab State: default to "watched"
  const [activeProfileTab, setActiveProfileTab] = useState<"watched" | "watchlist" | "reviews" | "lists">("watched");

  // Multi-genre filtering
  const [selectedWatchedGenres, setSelectedWatchedGenres] = useState<string[]>([]);
  const [watchedGenreMode, setWatchedGenreMode] = useState<"all" | "any">("all");

  const [selectedWatchlistGenres, setSelectedWatchlistGenres] = useState<string[]>([]);
  const [watchlistGenreMode, setWatchlistGenreMode] = useState<"all" | "any">("all");

  const realUserId = profile?.user_id || targetUserId;
  const isOwnProfile = currentUser?.id === realUserId;

  // Map of (type_movieId) -> rating number (1-10) for profile owner
  const ratingsMap = useMemo(() => {
    const map: Record<string, number> = {};
    ratings.forEach((r: any) => {
      if (r?.movie_id && r?.rating) {
        const type = r.content_type || "movie";
        map[`${type}_${r.movie_id}`] = r.rating;
        map[r.movie_id] = r.rating;
      }
    });
    return map;
  }, [ratings]);

  // Map of (type_movieId) -> rating number (1-10) for CURRENT VIEWER
  const myRatingsMap = useMemo(() => {
    const map: Record<string, number> = {};
    myRatings.forEach((r: any) => {
      if (r?.movie_id && r?.rating !== undefined && r?.rating !== null) {
        const type = r.content_type || "movie";
        map[`${type}_${r.movie_id}`] = r.rating;
        map[r.movie_id] = r.rating;
      }
    });
    return map;
  }, [myRatings]);

  // Available sort options
  const sortOptions = useMemo(() => {
    if (isOwnProfile || !currentUser?.id) {
      return BASE_SORT_OPTIONS.filter((o) => o.id !== "my_rating_desc" && o.id !== "my_rating_asc");
    }
    return BASE_SORT_OPTIONS;
  }, [isOwnProfile, currentUser?.id]);

  // Fetch TMDB backdrop_path for Film 1 or TV 1 in Top 5
  useEffect(() => {
    const film1 = favorites.find((f: any) => f.slot_type === "movie_1");
    const tv1 = favorites.find((f: any) => f.slot_type === "tv_1");
    const bannerItem = film1 || tv1;
    const isTv = !film1 && !!tv1;

    if (!bannerItem?.tmdb_id) {
      setBannerBackdropUrl(null);
      setBannerMovieTitle(null);
      return;
    }

    let isMounted = true;
    async function fetchBannerBackdrop() {
      try {
        const endpoint = isTv ? `tv/${bannerItem.tmdb_id}` : `movie/${bannerItem.tmdb_id}`;
        const res = await fetch(`/api/tmdb?endpoint=${endpoint}&append_to_response=images`);
        if (res.ok) {
          const data = await res.json();
          if (!isMounted) return;
          const backdropPath = data.backdrop_path || data.images?.backdrops?.[0]?.file_path;
          if (backdropPath) {
            setBannerBackdropUrl(`https://image.tmdb.org/t/p/w1280${backdropPath}`);
            setBannerMovieTitle(data.title || data.name || bannerItem.name);
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
    if (!targetUserId) {
      setLoading(false);
      return;
    }

    async function loadAll() {
      setLoading(true);
      try {
        const isUserId =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId) ||
          /^cred_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId) ||
          /^\d+$/.test(targetUserId);
        const profileUrl = isUserId
          ? `/api/user-profile?userId=${targetUserId}`
          : `/api/user-profile?username=${encodeURIComponent(targetUserId)}`;
        const pRes = await fetch(profileUrl);
        if (!pRes.ok) { setProfile(null); setLoading(false); return; }
        const profileData = await pRes.json();
        setProfile(profileData);

        // Redirect old /profile/[userId] URLs to /u/[username]
        if (profileData?.username && typeof window !== "undefined") {
          const path = window.location.pathname;
          if (path.startsWith("/profile/")) {
            router.replace(`/u/${profileData.username}`);
            return;
          }
        }

        const activeId = profileData.user_id;

        const [
          followStatusRes,
          followCountsRes,
          reviewsRes,
          ratingsRes,
          watchedRes,
          watchlistRes,
          favoritesRes,
          publicListsRes,
          myRatingsRes,
          posterPrefsRes,
        ] = await Promise.all([
          currentUser?.id && currentUser?.id !== activeId
            ? fetch(`/api/follows?followerId=${currentUser.id}&followingId=${activeId}`).then((r) => r.json())
            : Promise.resolve(null),
          fetch(`/api/follows?userId=${activeId}`).then((r) => r.json()),
          supabase.from("reviews").select("*").eq("user_id", activeId).order("created_at", { ascending: false }).limit(30),
          supabase.from("ratings").select("*").eq("user_id", activeId).order("created_at", { ascending: false }),
          supabase.from("watched").select("*").eq("user_id", activeId).order("watched_at", { ascending: false }),
          supabase.from("watchlist").select("*").eq("user_id", activeId).order("created_at", { ascending: false }),
          fetch(`/api/favorites?userId=${activeId}`).then((r) => (r.ok ? r.json() : [])),
          fetch(`/api/lists?userId=${encodeURIComponent(activeId)}`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
          currentUser?.id && currentUser.id !== activeId
            ? supabase.from("ratings").select("*").eq("user_id", currentUser.id)
            : Promise.resolve({ data: [] }),
          fetch(`/api/watch-log?userId=${activeId}`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
          supabase.from("user_poster_preferences").select("movie_id, poster_path, content_type").eq("user_id", activeId),
        ]);

        if (followStatusRes) setFollowing(followStatusRes.isFollowing);
        setFollowCounts({ followers: followCountsRes?.followerCount || 0, following: followCountsRes?.followingCount || 0 });

        const revs = reviewsRes.data || [];
        const rats = ratingsRes.data || [];
        const watchedList = watchedRes.data || [];
        const watchlistList = watchlistRes.data || [];
        const watchLogList = Array.isArray(arguments?.[0]) ? [] : (arguments as any);

        // Build and set poster preferences IMMEDIATELY
        const prefsMap: Record<string, string> = {};
        (posterPrefsRes.data || []).forEach((p: any) => {
          if (p.movie_id && p.poster_path) {
            const type = p.content_type || "movie";
            prefsMap[`${type}_${p.movie_id}`] = p.poster_path;
            prefsMap[p.movie_id] = p.poster_path;
          }
        });
        watchedList.forEach((w: any) => {
          if (w.movie_id && w.poster_path) {
            const type = w.content_type || "movie";
            if (!prefsMap[`${type}_${w.movie_id}`]) prefsMap[`${type}_${w.movie_id}`] = w.poster_path;
            if (!prefsMap[w.movie_id]) prefsMap[w.movie_id] = w.poster_path;
          }
        });
        watchlistList.forEach((wl: any) => {
          if (wl.movie_id && wl.poster_path) {
            const type = wl.content_type || "movie";
            if (!prefsMap[`${type}_${wl.movie_id}`]) prefsMap[`${type}_${wl.movie_id}`] = wl.poster_path;
            if (!prefsMap[wl.movie_id]) prefsMap[wl.movie_id] = wl.poster_path;
          }
        });
        setPosterPrefs(prefsMap);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(`cinesocial_poster_prefs_${activeId}`, JSON.stringify(prefsMap));
          } catch {}
        }

        setReviews(revs);
        setRatings(rats);
        setWatchItems(watchedList);
        setWatchlistItems(watchlistList);
        setMyRatings(myRatingsRes.data || []);

        // Compute rewatch counts from watch_log
        fetch(`/api/watch-log?userId=${activeId}`)
          .then((r) => (r.ok ? r.json() : []))
          .then((wLogs: any[]) => {
            if (Array.isArray(wLogs)) {
              const rwMap: Record<string, number> = {};
              wLogs.forEach((wl: any) => {
                if (wl.is_rewatch) {
                  const key = `${wl.content_type || "movie"}_${wl.content_id}`;
                  rwMap[key] = (rwMap[key] || 0) + 1;
                  rwMap[wl.content_id] = (rwMap[wl.content_id] || 0) + 1;
                }
              });
              setRewatchCounts(rwMap);
            }
          })
          .catch(() => {});

        const favsArray = Array.isArray(favoritesRes) ? favoritesRes : [];
        setFavorites(favsArray);
        const listsData = Array.isArray(publicListsRes) ? publicListsRes.filter((l: any) => l.is_public !== false) : [];
        setPublicLists(listsData);

        // Fetch TMDB details for movies and TV shows
        const uniqueMedia = new Map<string, { id: string; type: "movie" | "tv" }>();
        const registerMedia = (item: any) => {
          if (!item?.movie_id) return;
          const id = String(item.movie_id);
          const type: "movie" | "tv" = item.content_type === "tv" ? "tv" : "movie";
          uniqueMedia.set(`${type}_${id}`, { id, type });
        };

        rats.forEach(registerMedia);
        revs.forEach(registerMedia);
        watchedList.forEach(registerMedia);
        watchlistList.forEach(registerMedia);
        favsArray.forEach((fav: any) => {
          if (fav?.tmdb_id) {
            const isTv = fav.slot_type?.startsWith("tv_");
            const type = isTv ? "tv" : "movie";
            uniqueMedia.set(`${type}_${fav.tmdb_id}`, { id: String(fav.tmdb_id), type });
          }
        });

        // Seed initial mediaDetails immediately with CUSTOM POSTERS
        const initialDet: Record<string, any> = {};
        [...watchedList, ...watchlistList].forEach((item: any) => {
          if (item?.movie_id) {
            const id = String(item.movie_id);
            const type = item.content_type || "movie";
            const customPoster = prefsMap[`${type}_${id}`] || prefsMap[id] || item.poster_path;
            const seed = {
              id: item.movie_id,
              title: item.movie_title,
              name: item.movie_title,
              poster_path: customPoster,
            };
            initialDet[`${type}_${id}`] = seed;
            if (!initialDet[id]) initialDet[id] = seed;
          }
        });
        setMediaDetails(initialDet);
        setLoading(false); // Unblock profile display immediately with custom posters!

        const det: Record<string, any> = { ...initialDet };
        const mediaList = Array.from(uniqueMedia.values());
        const CHUNK_SIZE = 8;
        for (let i = 0; i < mediaList.length; i += CHUNK_SIZE) {
          const chunk = mediaList.slice(i, i + CHUNK_SIZE);
          await Promise.all(
            chunk.map(async ({ id, type }) => {
              try {
                const r = await fetch(`/api/tmdb?endpoint=${type}/${id}`);
                if (r.ok) {
                  const d = await r.json();
                  const customPoster = prefsMap[`${type}_${id}`] || prefsMap[id];
                  if (customPoster) {
                    d.poster_path = customPoster;
                  }
                  det[`${type}_${id}`] = d;
                  if (!det[id]) det[id] = d;
                }
              } catch {}
            })
          );
          setMediaDetails({ ...det });
        }
      } catch (err) {
        console.error("PublicProfilePage loadAll error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, [targetUserId, currentUser?.id]);

  // Split Counts
  const watchedMovies = useMemo(() => watchItems.filter((w) => (w.content_type || "movie") !== "tv"), [watchItems]);
  const watchedTv = useMemo(() => watchItems.filter((w) => w.content_type === "tv"), [watchItems]);

  const watchedTvAnime = useMemo(() => {
    return watchedTv.filter((w) => {
      const detail = mediaDetails[`tv_${w.movie_id}`] || mediaDetails[w.movie_id] || w;
      return isAnimeShow(detail);
    });
  }, [watchedTv, mediaDetails]);

  const watchedTvOthers = useMemo(() => {
    return watchedTv.filter((w) => {
      const detail = mediaDetails[`tv_${w.movie_id}`] || mediaDetails[w.movie_id] || w;
      return !isAnimeShow(detail);
    });
  }, [watchedTv, mediaDetails]);

  const currentWatchedTv = useMemo(() => {
    if (tvSubFilter === "anime") return watchedTvAnime;
    if (tvSubFilter === "others") return watchedTvOthers;
    return watchedTv;
  }, [tvSubFilter, watchedTvAnime, watchedTvOthers, watchedTv]);

  const watchlistMovies = useMemo(() => watchlistItems.filter((w) => (w.content_type || "movie") !== "tv"), [watchlistItems]);
  const watchlistTv = useMemo(() => watchlistItems.filter((w) => w.content_type === "tv"), [watchlistItems]);

  const reviewsMovies = useMemo(() => reviews.filter((r) => (r.content_type || "movie") !== "tv"), [reviews]);
  const reviewsTv = useMemo(() => reviews.filter((r) => r.content_type === "tv"), [reviews]);

  const reviewsTvAnime = useMemo(() => {
    return reviewsTv.filter((r) => {
      const detail = mediaDetails[`tv_${r.movie_id}`] || mediaDetails[r.movie_id] || r;
      return isAnimeShow(detail);
    });
  }, [reviewsTv, mediaDetails]);

  const reviewsTvOthers = useMemo(() => {
    return reviewsTv.filter((r) => {
      const detail = mediaDetails[`tv_${r.movie_id}`] || mediaDetails[r.movie_id] || r;
      return !isAnimeShow(detail);
    });
  }, [reviewsTv, mediaDetails]);

  const currentReviewsTv = useMemo(() => {
    if (tvSubFilter === "anime") return reviewsTvAnime;
    if (tvSubFilter === "others") return reviewsTvOthers;
    return reviewsTv;
  }, [tvSubFilter, reviewsTvAnime, reviewsTvOthers, reviewsTv]);

  const distinctGenresCount = useMemo(() => {
    const genresSet = new Set<number>();
    watchItems.forEach((w) => {
      const type = w.content_type === "tv" ? "tv" : "movie";
      const movie = mediaDetails[`${type}_${w.movie_id}`] || mediaDetails[w.movie_id];
      if (movie?.genres) {
        movie.genres.forEach((g: any) => genresSet.add(g.id));
      }
    });
    return genresSet.size;
  }, [watchItems, mediaDetails]);

  const currentWatched = mediaFilter === "tv" ? currentWatchedTv : watchedMovies;
  const currentReviews = mediaFilter === "tv" ? currentReviewsTv : reviewsMovies;
  const currentWatchlist = watchlistMediaFilter === "tv" ? watchlistTv : watchlistMovies;

  // Runtime helper
  const getItemRuntime = (item: any) => {
    const type = item.content_type === "tv" ? "tv" : "movie";
    const detail = mediaDetails[`${type}_${item.movie_id}`] || mediaDetails[item.movie_id];
    if (type === "tv") {
      return (
        detail?.episode_run_time?.[0] ||
        detail?.runtime ||
        (detail?.number_of_episodes ? detail.number_of_episodes * 45 : 0) ||
        0
      );
    }
    return detail?.runtime || 0;
  };

  // Generic genre matcher
  const matchesGenres = (item: any, selected: string[], mode: "all" | "any") => {
    if (!selected || selected.length === 0) return true;
    const type = item.content_type === "tv" ? "tv" : "movie";
    const detail = mediaDetails[`${type}_${item.movie_id}`] || mediaDetails[item.movie_id];
    const names = new Set<string>();

    if (detail?.genres && Array.isArray(detail.genres)) {
      detail.genres.forEach((g: any) => {
        if (g?.name) names.add(g.name);
        if (g?.id && GENRE_MAP[g.id]) names.add(GENRE_MAP[g.id]);
      });
    }
    if (detail?.genre_ids && Array.isArray(detail.genre_ids)) {
      detail.genre_ids.forEach((gid: number) => {
        if (GENRE_MAP[gid]) names.add(GENRE_MAP[gid]);
      });
    }

    if (mode === "all") {
      return selected.every((g) => names.has(g));
    } else {
      return selected.some((g) => names.has(g));
    }
  };

  // Generic media sorter
  const sortMediaList = (list: any[], sort: SortOption) => {
    return [...list].sort((a, b) => {
      const typeA = a.content_type === "tv" ? "tv" : "movie";
      const typeB = b.content_type === "tv" ? "tv" : "movie";
      const itemA = mediaDetails[`${typeA}_${a.movie_id}`] || mediaDetails[a.movie_id] || a;
      const itemB = mediaDetails[`${typeB}_${b.movie_id}`] || mediaDetails[b.movie_id] || b;

      // My Rating sorting (order films friend watched by viewer's ratings)
      if (sort === "my_rating_desc" || sort === "my_rating_asc") {
        const myA = myRatingsMap[`${typeA}_${a.movie_id}`] ?? myRatingsMap[a.movie_id];
        const myB = myRatingsMap[`${typeB}_${b.movie_id}`] ?? myRatingsMap[b.movie_id];
        const hasA = myA !== undefined && myA !== null;
        const hasB = myB !== undefined && myB !== null;
        if (hasA && !hasB) return -1;
        if (!hasA && hasB) return 1;
        if (hasA && hasB && myA !== myB) {
          return sort === "my_rating_desc" ? myB - myA : myA - myB;
        }
      }

      // Friend's Rating sorting
      if (sort === "rating_desc" || sort === "rating_asc") {
        const ratingA = ratingsMap[`${typeA}_${a.movie_id}`] ?? ratingsMap[a.movie_id] ?? 0;
        const ratingB = ratingsMap[`${typeB}_${b.movie_id}`] ?? ratingsMap[b.movie_id] ?? 0;
        if (ratingA !== ratingB) {
          return sort === "rating_desc" ? ratingB - ratingA : ratingA - ratingB;
        }
      }

      // Runtime sorting
      if (sort === "runtime_desc" || sort === "runtime_asc") {
        const rtA = getItemRuntime(a);
        const rtB = getItemRuntime(b);
        if (rtA !== rtB) {
          return sort === "runtime_desc" ? rtB - rtA : rtA - rtB;
        }
      }

      if (sort === "tmdb_desc" || sort === "tmdb_asc") {
        const voteA = itemA?.vote_average ?? 0;
        const voteB = itemB?.vote_average ?? 0;
        if (voteA !== voteB) {
          return sort === "tmdb_desc" ? voteB - voteA : voteA - voteB;
        }
      }

      if (sort === "year_desc" || sort === "year_asc") {
        const dateA = itemA?.release_date || itemA?.first_air_date || itemA?.year || "";
        const dateB = itemB?.release_date || itemB?.first_air_date || itemB?.year || "";
        const yearA = dateA ? parseInt(String(dateA).substring(0, 4), 10) || 0 : 0;
        const yearB = dateB ? parseInt(String(dateB).substring(0, 4), 10) || 0 : 0;
        if (yearA !== yearB) {
          return sort === "year_desc" ? yearB - yearA : yearA - yearB;
        }
      }

      if (sort === "title_asc") {
        const titleA = String(itemA?.title || itemA?.name || itemA?.movie_title || "").toLowerCase();
        const titleB = String(itemB?.title || itemB?.name || itemB?.movie_title || "").toLowerCase();
        const comp = titleA.localeCompare(titleB);
        if (comp !== 0) return comp;
      }

      if (sort === "date_added_desc") {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : a.watched_at ? new Date(a.watched_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : b.watched_at ? new Date(b.watched_at).getTime() : 0;
        return timeB - timeA;
      }

      if (sort === "date_added_asc") {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : a.watched_at ? new Date(a.watched_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : b.watched_at ? new Date(b.watched_at).getTime() : 0;
        return timeA - timeB;
      }

      // Default (date watched or added desc)
      const timeA = a.watched_at ? new Date(a.watched_at).getTime() : a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.watched_at ? new Date(b.watched_at).getTime() : b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });
  };

  // Filtered & Sorted Watched items
  const sortedWatched = useMemo(() => {
    if (!currentWatched || currentWatched.length === 0) return [];
    const genreFiltered = currentWatched.filter((item) =>
      matchesGenres(item, selectedWatchedGenres, watchedGenreMode)
    );
    return sortMediaList(genreFiltered, watchedSort);
  }, [currentWatched, selectedWatchedGenres, watchedGenreMode, watchedSort, mediaDetails, ratingsMap, myRatingsMap]);

  // Filtered & Sorted Watchlist items
  const sortedWatchlist = useMemo(() => {
    if (!currentWatchlist || currentWatchlist.length === 0) return [];
    const genreFiltered = currentWatchlist.filter((item) =>
      matchesGenres(item, selectedWatchlistGenres, watchlistGenreMode)
    );
    return sortMediaList(genreFiltered, watchlistSort);
  }, [currentWatchlist, selectedWatchlistGenres, watchlistGenreMode, watchlistSort, mediaDetails, ratingsMap, myRatingsMap]);

  const toggleFollow = async () => {
    const activeUserId = profile?.user_id || targetUserId;
    if (!currentUser?.id) {
      showAuthPrompt({
        title: "Follow User",
        message: "Sign in to follow cinephiles and see their reviews and activity in your feed.",
      });
      return;
    }
    setFollowLoading(true);
    try {
      if (following) {
        await fetch(`/api/follows?followerId=${currentUser.id}&followingId=${activeUserId}`, { method: "DELETE" });
        setFollowing(false);
        setFollowCounts((prev) => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
      } else {
        await fetch("/api/follows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            follower_id: currentUser.id,
            following_id: activeUserId,
            follower_name: currentUser.name || currentUser.email || undefined,
            follower_avatar: currentUser.image || undefined,
          }),
        });
        setFollowing(true);
        setFollowCounts((prev) => ({ ...prev, followers: prev.followers + 1 }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleShareProfile = async () => {
    const url = profile?.username
      ? `${window.location.origin}/u/${profile.username}`
      : window.location.href;

    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      /mobile|android|iphone|ipad/i.test(navigator.userAgent)
    ) {
      try {
        await navigator.share({
          title: `${profile?.display_name || "Cine Social"} on Cine Social`,
          text: `Check out ${profile?.display_name || "my"} profile on Cine Social!`,
          url,
        });
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      showToast("Profile link copied to clipboard!");
    } catch {
      showToast("Failed to copy link.");
    }
  };

  const openFollowList = async (type: "followers" | "following") => {
    const activeUserId = profile?.user_id || targetUserId;
    setFollowListModal({ type, users: [], loading: true });
    try {
      const res = await fetch(`/api/follows/list?userId=${encodeURIComponent(activeUserId)}&type=${type}`);
      const data = await res.json();
      const userList = Array.isArray(data.users) ? data.users : [];
      setFollowListModal({ type, users: userList, loading: false });
      // Derive count from list length so they can never disagree
      setFollowCounts((prev) => ({
        ...prev,
        [type]: userList.length,
      }));
    } catch (e) {
      console.error("Error opening follow list:", e);
      setFollowListModal({ type, users: [], loading: false });
    }
  };

  const renderGenreChips = (
    selected: string[],
    setSelected: React.Dispatch<React.SetStateAction<string[]>>,
    mode: "all" | "any",
    setMode: React.Dispatch<React.SetStateAction<"all" | "any">>
  ) => (
    <div className="space-y-2 mb-4 bg-white/[0.02] p-3 rounded-2xl border border-white/5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
          <span className="material-symbols-outlined text-[15px]">filter_list</span>
          <span>Genres:</span>
          {selected.length > 0 && (
            <button
              onClick={() => setSelected([])}
              className="text-[11px] text-primary hover:underline ml-1 cursor-pointer bg-transparent border-none font-bold"
            >
              Clear ({selected.length})
            </button>
          )}
        </div>

        {/* Any / All Toggle */}
        <div className="flex items-center gap-1 p-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold">
          <span className="px-2 text-on-surface-variant/60 uppercase">Match:</span>
          <button
            onClick={() => setMode("all")}
            className={`px-2.5 py-0.5 rounded-full transition-all cursor-pointer border-none ${
              mode === "all"
                ? "bg-primary text-black font-extrabold shadow-sm"
                : "bg-transparent text-on-surface-variant hover:text-white"
            }`}
          >
            ALL
          </button>
          <button
            onClick={() => setMode("any")}
            className={`px-2.5 py-0.5 rounded-full transition-all cursor-pointer border-none ${
              mode === "any"
                ? "bg-primary text-black font-extrabold shadow-sm"
                : "bg-transparent text-on-surface-variant hover:text-white"
            }`}
          >
            ANY
          </button>
        </div>
      </div>

      {/* Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
        {GENRE_LIST.map((genre) => {
          const isSelected = selected.includes(genre);
          return (
            <button
              key={genre}
              onClick={() => {
                setSelected((prev) =>
                  isSelected ? prev.filter((g) => g !== genre) : [...prev, genre]
                );
              }}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer border flex items-center gap-1 shrink-0 ${
                isSelected
                  ? "bg-primary/20 text-primary border-primary shadow-[0_0_10px_rgba(255,180,170,0.2)] font-bold"
                  : "bg-white/5 text-on-surface-variant border-white/10 hover:border-white/20 hover:text-white"
              }`}
            >
              {isSelected && <span className="material-symbols-outlined text-[13px]">check</span>}
              {genre}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="bg-[#050505] text-[#e5e2e1] font-body-md overflow-x-clip min-h-screen relative pb-32">
      {/* Top App Bar */}
      <header
        className={`fixed top-0 left-0 w-full z-50 flex justify-between items-center px-container-margin transition-all duration-300 ${
          scrolled
            ? "py-stack-sm bg-[#131313]/90 backdrop-blur-md border-b border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]"
            : "py-stack-md bg-gradient-to-b from-[#050505]/90 via-[#050505]/40 to-transparent border-none"
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors text-sm font-semibold cursor-pointer border-none bg-transparent"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back
          </button>
        </div>

        <Link href="/" className="hover:opacity-90 transition-all block">
          <h1 className="font-display-md text-[24px] text-primary tracking-tighter uppercase select-none font-serif drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
            CINE SOCIAL
          </h1>
        </Link>

        <div className="flex items-center gap-3">
          <NotificationBell />
          {currentUser && (
            <Link
              href="/profile"
              className="w-8 h-8 rounded-full overflow-hidden border border-white/10 hover:opacity-80 transition-all flex items-center justify-center bg-white/5"
            >
              {currentUser.image ? (
                <img alt={currentUser.name || "User"} className="w-full h-full object-cover" src={getSafeAvatarUrl(currentUser.image) || ""} />
              ) : (
                <span className="material-symbols-outlined text-on-surface-variant text-base">person</span>
              )}
            </Link>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-[100px] px-container-margin max-w-screen-xl mx-auto w-full">
        {loading ? (
          <UserProfileSkeleton />
        ) : !profile ? (
          <div className="text-center py-20 text-on-surface-variant">
            <span className="material-symbols-outlined text-5xl mb-3 opacity-30">person_off</span>
            <p className="text-lg font-serif">User not found</p>
          </div>
        ) : (
          <>
            {/* Banner Backdrop (hidden if private and not owner) */}
            {bannerBackdropUrl && (!profile?.is_private || isOwnProfile) && (
              <div className="relative w-full h-48 md:h-64 rounded-3xl overflow-hidden mb-6 border border-white/10 shadow-2xl">
                <img src={bannerBackdropUrl} alt={bannerMovieTitle || "Profile Banner"} className="w-full h-full object-cover object-center filter brightness-[0.65]" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent" />
                {bannerMovieTitle && (
                  <div className="absolute bottom-3 right-4 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-mono text-white/70 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-xs text-primary">movie</span>
                    <span>{bannerMovieTitle}</span>
                  </div>
                )}
              </div>
            )}

            {/* Profile Header */}
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-8 text-center md:text-left">
              <div
                onClick={() => profile.avatar_url && setAvatarModalOpen(true)}
                className={`relative w-24 h-24 md:w-28 md:md:h-28 rounded-full overflow-hidden border-2 border-white/20 shadow-xl bg-white/5 flex-shrink-0 ${
                  profile.avatar_url ? "cursor-pointer group" : ""
                }`}
              >
                {profile.avatar_url ? (
                  <img src={getSafeAvatarUrl(profile.avatar_url) || ""} alt={profile.display_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/20 text-primary font-serif font-bold text-3xl">
                    {(profile.display_name || "?").slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="font-serif text-2xl font-bold text-on-surface">{profile.display_name}</h2>
                    {profile.username && <p className="text-sm font-mono text-primary/80">@{profile.username}</p>}
                    {profile.bio && <p className="text-sm text-on-surface-variant mt-2 max-w-xl">{profile.bio}</p>}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap justify-center md:justify-start">
                    {isOwnProfile && (
                      <button
                        onClick={handleShareProfile}
                        className="px-5 py-2 rounded-full font-bold text-sm bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
                      >
                        <span className="material-symbols-outlined text-base">share</span>
                        Share
                      </button>
                    )}

                    {!isOwnProfile && (
                      <button
                        onClick={toggleFollow}
                        disabled={followLoading}
                        className={`px-6 py-2 rounded-full font-bold text-sm transition-all duration-200 cursor-pointer border ${
                          following
                            ? "bg-white/10 text-white border-white/20 hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
                            : "bg-primary text-black border-primary hover:brightness-110 shadow-[0_0_16px_rgba(255,180,170,0.3)]"
                        } disabled:opacity-50`}
                      >
                        {followLoading ? "..." : following ? "Following" : "Follow"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Follower Counts (only if public or own profile) */}
                {(!profile?.is_private || isOwnProfile) && (
                  <div className="flex items-center justify-center md:justify-start gap-6 mt-4 text-xs">
                    <button onClick={() => openFollowList("followers")} className="hover:text-primary transition-colors cursor-pointer bg-transparent border-none">
                      <span className="font-bold text-white text-sm">{followCounts.followers}</span> <span className="text-on-surface-variant">Followers</span>
                    </button>
                    <button onClick={() => openFollowList("following")} className="hover:text-primary transition-colors cursor-pointer bg-transparent border-none">
                      <span className="font-bold text-white text-sm">{followCounts.following}</span> <span className="text-on-surface-variant">Following</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* If private and visitor is not owner, show restricted view */}
            {profile?.is_private && !isOwnProfile ? (
              <div className="w-full max-w-md mx-auto my-12 p-8 rounded-2xl bg-white/[0.03] border border-white/10 text-center flex flex-col items-center gap-3 animate-fade-in shadow-xl">
                <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-primary mb-1">
                  <span className="material-symbols-outlined text-3xl">lock</span>
                </div>
                <h3 className="font-serif text-xl font-bold text-white">This Account is Private</h3>
                <p className="text-xs text-on-surface-variant max-w-xs leading-relaxed">
                  Follow this account to see their watched films, reviews, ratings, and lists.
                </p>
              </div>
            ) : (
              <>
            {/* Badges Showcase */}
            <div className="mb-8">
              <ProfileBadges
                watchedCount={watchItems.length}
                reviewCount={reviews.length}
                distinctGenresCount={distinctGenresCount}
              />
            </div>

            {/* Taste Match Widget (when viewing another user's profile) */}
            {!isOwnProfile && currentUser?.id && (
              <div className="mb-8">
                <TasteMatchWidget userA={currentUser.id} userB={realUserId} />
              </div>
            )}

            {/* Rating Distribution Chart */}
            {ratings.length > 0 && (
              <div className="mb-8">
                <RatingDistributionChart ratings={ratings} mediaDetails={mediaDetails} posterPrefs={posterPrefs} />
              </div>
            )}

            {/* Top 5 Films Showcase */}
            {(() => {
              const filmSlots = ["movie_1", "movie_2", "movie_3", "movie_4", "movie_5"] as const;
              const topFilms = filmSlots.map((s) => favorites.find((f: any) => f.slot_type === s)).filter(Boolean);
              if (topFilms.length === 0) return null;
              return (
                <section className="mb-8">
                  <h3 className="text-xs text-on-surface-variant uppercase tracking-widest mb-4 border-l-2 border-primary pl-2">
                    Favourite Films
                  </h3>
                  <div className="grid grid-cols-5 gap-2">
                    {filmSlots.map((slot) => {
                      const fav = favorites.find((f: any) => f.slot_type === slot);
                      if (!fav) return (
                        <div key={slot} className="aspect-[2/3] rounded-xl bg-white/5 border border-white/5 flex items-center justify-center">
                          <span className="material-symbols-outlined text-on-surface-variant/20 text-[20px]">movie</span>
                        </div>
                      );
                      const posterUrl = getPosterUrl({ movieId: fav.tmdb_id, contentType: "movie", defaultPosterPath: fav.image_url, posterPrefs, size: "w342" });
                      return (
                        <Link href={getMovieUrl(fav.tmdb_id, fav.name)} key={slot} className="aspect-[2/3] rounded-xl overflow-hidden border border-white/10 group relative block" title={fav.name}>
                          <img src={posterUrl} alt={fav.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                            <p className="text-[9px] text-white font-bold line-clamp-2 leading-tight">{fav.name}</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })()}

            {/* Top 5 TV Shows Showcase */}
            {(() => {
              const tvSlots = ["tv_1", "tv_2", "tv_3", "tv_4", "tv_5"] as const;
              const topTv = tvSlots.map((s) => favorites.find((f: any) => f.slot_type === s)).filter(Boolean);
              if (topTv.length === 0) return null;
              return (
                <section className="mb-8">
                  <h3 className="text-xs text-on-surface-variant uppercase tracking-widest mb-4 border-l-2 border-purple-500 pl-2">
                    Favourite TV Shows
                  </h3>
                  <div className="grid grid-cols-5 gap-2">
                    {tvSlots.map((slot) => {
                      const fav = favorites.find((f: any) => f.slot_type === slot);
                      if (!fav) return (
                        <div key={slot} className="aspect-[2/3] rounded-xl bg-white/5 border border-white/5 flex items-center justify-center">
                          <span className="material-symbols-outlined text-on-surface-variant/20 text-[20px]">tv</span>
                        </div>
                      );
                      const posterUrl = getPosterUrl({ movieId: fav.tmdb_id, contentType: "tv", defaultPosterPath: fav.image_url, posterPrefs, size: "w342" });
                      return (
                        <Link href={getTvUrl(fav.tmdb_id, fav.name)} key={slot} className="aspect-[2/3] rounded-xl overflow-hidden border border-white/10 group relative block" title={fav.name}>
                          <img src={posterUrl} alt={fav.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                            <p className="text-[9px] text-white font-bold line-clamp-2 leading-tight">{fav.name}</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })()}

            {/* Favorite Creatives */}
            {(() => {
              const creativeSlots = ["director", "actor", "actress"] as const;
              const slotLabels: Record<string, string> = { director: "Director", actor: "Actor", actress: "Actress" };
              const creatives = creativeSlots.map((slot) => favorites.find((f: any) => f.slot_type === slot)).filter(Boolean);
              if (creatives.length === 0) return null;
              return (
                <section className="mb-8">
                  <h3 className="text-xs text-on-surface-variant uppercase tracking-widest mb-4 border-l-2 border-[#e9c349] pl-2">
                    Favourite Creatives
                  </h3>
                  <div className="flex gap-5 flex-wrap">
                    {creatives.map((fav: any) => (
                      <div key={fav.slot_type} className="flex flex-col items-center gap-2 group">
                        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-primary/40 transition-colors shadow-md bg-white/5 flex-shrink-0">
                          {fav.image_url ? (
                            <img src={`https://image.tmdb.org/t/p/w185${fav.image_url}`} alt={fav.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="material-symbols-outlined text-on-surface-variant/40 text-2xl">person</span>
                            </div>
                          )}
                        </div>
                        <div className="text-center">
                          <p className="text-[11px] font-semibold text-on-surface leading-tight max-w-[72px] truncate">{fav.name}</p>
                          <p className="text-[9px] uppercase tracking-widest text-on-surface-variant/60 mt-0.5">{slotLabels[fav.slot_type] || fav.slot_type}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })()}

            {/* ========================================================================= */}
            {/* PROFILE TABS: Watched (Default), Watchlist, Reviews, Lists */}
            {/* ========================================================================= */}
            <div className="border-b border-white/10 mb-6 pt-4">
              <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setActiveProfileTab("watched")}
                  className={`pb-3 font-serif text-sm font-bold uppercase tracking-wider relative transition-colors cursor-pointer bg-transparent border-none ${
                    activeProfileTab === "watched" ? "text-primary" : "text-on-surface-variant hover:text-white"
                  }`}
                >
                  Watched ({watchedMovies.length + watchedTv.length})
                  {activeProfileTab === "watched" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_8px_rgba(255,180,170,0.8)]" />
                  )}
                </button>

                <button
                  onClick={() => setActiveProfileTab("watchlist")}
                  className={`pb-3 font-serif text-sm font-bold uppercase tracking-wider relative transition-colors cursor-pointer bg-transparent border-none ${
                    activeProfileTab === "watchlist" ? "text-primary" : "text-on-surface-variant hover:text-white"
                  }`}
                >
                  Watchlist ({watchlistMovies.length + watchlistTv.length})
                  {activeProfileTab === "watchlist" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_8px_rgba(255,180,170,0.8)]" />
                  )}
                </button>

                <button
                  onClick={() => setActiveProfileTab("reviews")}
                  className={`pb-3 font-serif text-sm font-bold uppercase tracking-wider relative transition-colors cursor-pointer bg-transparent border-none ${
                    activeProfileTab === "reviews" ? "text-primary" : "text-on-surface-variant hover:text-white"
                  }`}
                >
                  Reviews ({reviews.length})
                  {activeProfileTab === "reviews" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_8px_rgba(255,180,170,0.8)]" />
                  )}
                </button>

                <button
                  onClick={() => setActiveProfileTab("lists")}
                  className={`pb-3 font-serif text-sm font-bold uppercase tracking-wider relative transition-colors cursor-pointer bg-transparent border-none ${
                    activeProfileTab === "lists" ? "text-primary" : "text-on-surface-variant hover:text-white"
                  }`}
                >
                  Lists ({publicLists.length})
                  {activeProfileTab === "lists" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_8px_rgba(255,180,170,0.8)]" />
                  )}
                </button>
              </div>
            </div>

            {/* TAB 1: WATCHED */}
            {activeProfileTab === "watched" && (
              <section className="animate-fade-in">
                {/* Media Switcher: Movies vs TV Shows */}
                <div className="flex flex-wrap items-center gap-3 mb-5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setMediaFilter("movie")}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                        mediaFilter === "movie"
                          ? "bg-[#e50914] text-white border-[#e50914] shadow-[0_0_12px_rgba(229,9,20,0.4)]"
                          : "bg-white/5 text-on-surface-variant border-white/10 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">movie</span>
                      Movies ({watchedMovies.length})
                    </button>
                    <button
                      onClick={() => setMediaFilter("tv")}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                        mediaFilter === "tv"
                          ? "bg-[#a855f7] text-white border-[#a855f7] shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                          : "bg-white/5 text-on-surface-variant border-white/10 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">tv</span>
                      TV Shows ({watchedTv.length})
                    </button>
                  </div>

                  {/* Sub-filter for TV */}
                  {mediaFilter === "tv" && (
                    <div className="flex items-center gap-1.5 p-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md animate-fade-in">
                      <button
                        onClick={() => setTvSubFilter("all")}
                        className={`px-3 py-0.5 rounded-full text-[11px] font-bold transition-all cursor-pointer border flex items-center gap-1 ${
                          tvSubFilter === "all"
                            ? "bg-[#a855f7] text-white border-[#a855f7]"
                            : "bg-transparent text-on-surface-variant border-transparent hover:text-white"
                        }`}
                      >
                        All ({watchedTv.length})
                      </button>
                      <button
                        onClick={() => setTvSubFilter("anime")}
                        className={`px-3 py-0.5 rounded-full text-[11px] font-bold transition-all cursor-pointer border flex items-center gap-1 ${
                          tvSubFilter === "anime"
                            ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white border-pink-400"
                            : "bg-transparent text-on-surface-variant border-transparent hover:text-white"
                        }`}
                      >
                        Anime ({watchedTvAnime.length})
                      </button>
                      <button
                        onClick={() => setTvSubFilter("others")}
                        className={`px-3 py-0.5 rounded-full text-[11px] font-bold transition-all cursor-pointer border flex items-center gap-1 ${
                          tvSubFilter === "others"
                            ? "bg-white/20 text-white border-white/40"
                            : "bg-transparent text-on-surface-variant border-transparent hover:text-white"
                        }`}
                      >
                        Others ({watchedTvOthers.length})
                      </button>
                    </div>
                  )}
                </div>

                {/* Genre Filter Row */}
                {renderGenreChips(selectedWatchedGenres, setSelectedWatchedGenres, watchedGenreMode, setWatchedGenreMode)}

                {/* Sort Bar */}
                <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-5 no-scrollbar scroll-smooth">
                  <span className="text-xs text-on-surface-variant uppercase tracking-widest font-semibold flex items-center gap-1 shrink-0 mr-1 opacity-70">
                    <span className="material-symbols-outlined text-[15px]">sort</span>
                    Sort:
                  </span>
                  {sortOptions.map((option) => {
                    const isActive = watchedSort === option.id;
                    return (
                      <button
                        key={option.id}
                        onClick={() => setWatchedSort(option.id)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer border flex items-center gap-1.5 select-none shrink-0 ${
                          isActive
                            ? mediaFilter === "tv"
                              ? "bg-[#a855f7] text-white border-[#a855f7] shadow-[0_0_12px_rgba(168,85,247,0.4)] font-bold scale-[1.02]"
                              : "bg-[#e50914] text-white border-[#e50914] shadow-[0_0_12px_rgba(229,9,20,0.4)] font-bold scale-[1.02]"
                            : "bg-white/5 text-on-surface-variant border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20"
                        }`}
                      >
                        {isActive && <span className="material-symbols-outlined text-[13px] font-bold">check</span>}
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                {/* Watched Grid */}
                {sortedWatched.length > 0 ? (
                  <div key={`${mediaFilter}_${watchedSort}`} className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 animate-fade-in">
                    {sortedWatched.map((item) => {
                      const type = item.content_type === "tv" ? "tv" : "movie";
                      const detail = mediaDetails[`${type}_${item.movie_id}`] || mediaDetails[item.movie_id];
                      const posterUrl = getPosterUrl({
                        movieId: item.movie_id,
                        contentType: type,
                        defaultPosterPath: item.poster_path || detail?.poster_path,
                        posterPrefs,
                        size: "w342",
                      });
                      const friendRating = ratingsMap[`${type}_${item.movie_id}`] ?? ratingsMap[item.movie_id];
                      const myRating = myRatingsMap[`${type}_${item.movie_id}`] ?? myRatingsMap[item.movie_id];
                      const displayTitle = detail?.title || detail?.name || item.movie_title || "";
                      const linkHref = type === "tv" ? getTvUrl(item.movie_id, displayTitle) : getMovieUrl(item.movie_id, displayTitle);

                      return (
                        <Link
                          key={item.id ? `${type}_${item.id}` : `${type}_${item.movie_id}_${item.watched_at || ""}`}
                          href={linkHref}
                          className="group aspect-[2/3] rounded-xl overflow-hidden border border-white/10 relative bg-white/5 block shadow-md hover:border-primary/40 transition-all"
                        >
                          <img
                            src={posterUrl}
                            alt={displayTitle}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />

                          {/* Top-Right: Friend's Rating Badge */}
                          {friendRating !== undefined && (
                            <div
                              className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-[#e9c349]/40 shadow-md z-10"
                              title={`${profile.display_name}'s rating: ${friendRating}/10`}
                            >
                              <span className="text-[#e9c349] text-[11px] leading-none">★</span>
                              <span className="text-[#e9c349] text-[11px] font-bold leading-none">
                                {friendRating % 1 === 0 ? friendRating : friendRating.toFixed(1)}
                              </span>
                            </div>
                          )}

                          {/* Top-Left: Viewer's (My) Rating Badge */}
                          {myRating !== undefined && !isOwnProfile && (
                            <div
                              className="absolute top-2 left-2 flex items-center gap-1 bg-primary text-black backdrop-blur-md px-1.5 py-0.5 rounded-md shadow-md z-10 text-[9px] font-extrabold border border-black/20"
                              title={`Your rating: ${myRating}/10`}
                            >
                              <span className="leading-none tracking-tight">YOU</span>
                              <span className="leading-none font-bold">★{myRating}</span>
                            </div>
                          )}

                          {/* Watched 2x badge */}
                          {(() => {
                            const rwCount = rewatchCounts[`${type}_${item.movie_id}`] || rewatchCounts[String(item.movie_id)] || 0;
                            if (rwCount > 0) {
                              return (
                                <div className="absolute bottom-2 left-2 z-10">
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-600/90 text-white backdrop-blur-md shadow-md border border-purple-400/40">
                                    Watched {rwCount + 1}×
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })()}

                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                            <p className="text-[10px] text-white font-bold line-clamp-2 leading-tight">{displayTitle}</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-on-surface-variant glass-card rounded-2xl border border-white/5 p-8">
                    <span className="material-symbols-outlined text-[36px] opacity-30 mb-2">{mediaFilter === "tv" ? "tv_off" : "movie"}</span>
                    <p className="text-sm">
                      {selectedWatchedGenres.length > 0
                        ? "No titles match the selected genre filters."
                        : `No ${mediaFilter === "tv" ? "TV shows" : "movies"} marked as watched yet.`}
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* TAB 2: WATCHLIST */}
            {activeProfileTab === "watchlist" && (
              <section className="animate-fade-in">
                {/* Media Switcher: Movies vs TV Shows */}
                <div className="flex flex-wrap items-center gap-3 mb-5">
                  <button
                    onClick={() => setWatchlistMediaFilter("movie")}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                      watchlistMediaFilter === "movie"
                        ? "bg-[#e50914] text-white border-[#e50914] shadow-[0_0_12px_rgba(229,9,20,0.4)]"
                        : "bg-white/5 text-on-surface-variant border-white/10 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">movie</span>
                    Movies ({watchlistMovies.length})
                  </button>
                  <button
                    onClick={() => setWatchlistMediaFilter("tv")}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                      watchlistMediaFilter === "tv"
                        ? "bg-[#a855f7] text-white border-[#a855f7] shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                        : "bg-white/5 text-on-surface-variant border-white/10 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">tv</span>
                    TV Shows ({watchlistTv.length})
                  </button>
                </div>

                {/* Genre Filter Row */}
                {renderGenreChips(selectedWatchlistGenres, setSelectedWatchlistGenres, watchlistGenreMode, setWatchlistGenreMode)}

                {/* Sort Bar */}
                <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-5 no-scrollbar scroll-smooth">
                  <span className="text-xs text-on-surface-variant uppercase tracking-widest font-semibold flex items-center gap-1 shrink-0 mr-1 opacity-70">
                    <span className="material-symbols-outlined text-[15px]">sort</span>
                    Sort:
                  </span>
                  {sortOptions.map((option) => {
                    const isActive = watchlistSort === option.id;
                    return (
                      <button
                        key={option.id}
                        onClick={() => setWatchlistSort(option.id)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer border flex items-center gap-1.5 select-none shrink-0 ${
                          isActive
                            ? watchlistMediaFilter === "tv"
                              ? "bg-[#a855f7] text-white border-[#a855f7] shadow-[0_0_12px_rgba(168,85,247,0.4)] font-bold scale-[1.02]"
                              : "bg-[#e50914] text-white border-[#e50914] shadow-[0_0_12px_rgba(229,9,20,0.4)] font-bold scale-[1.02]"
                            : "bg-white/5 text-on-surface-variant border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20"
                        }`}
                      >
                        {isActive && <span className="material-symbols-outlined text-[13px] font-bold">check</span>}
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                {/* Watchlist Grid */}
                {sortedWatchlist.length > 0 ? (
                  <div key={`watchlist_${watchlistMediaFilter}_${watchlistSort}`} className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 animate-fade-in">
                    {sortedWatchlist.map((item) => {
                      const type = item.content_type === "tv" ? "tv" : "movie";
                      const detail = mediaDetails[`${type}_${item.movie_id}`] || mediaDetails[item.movie_id];
                      const posterUrl = getPosterUrl({
                        movieId: item.movie_id,
                        contentType: type,
                        defaultPosterPath: item.poster_path || detail?.poster_path,
                        posterPrefs,
                        size: "w342",
                      });
                      const myRating = myRatingsMap[`${type}_${item.movie_id}`] ?? myRatingsMap[item.movie_id];
                      const displayTitle = detail?.title || detail?.name || item.movie_title || "";
                      const linkHref = type === "tv" ? getTvUrl(item.movie_id, displayTitle) : getMovieUrl(item.movie_id, displayTitle);

                      return (
                        <Link
                          key={item.id ? `wl_${type}_${item.id}` : `wl_${type}_${item.movie_id}_${item.created_at || ""}`}
                          href={linkHref}
                          className="group aspect-[2/3] rounded-xl overflow-hidden border border-white/10 relative bg-white/5 block shadow-md hover:border-primary/40 transition-all"
                        >
                          <img
                            src={posterUrl}
                            alt={displayTitle}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />

                          {/* Top-Left: Viewer's (My) Rating Badge if I already rated it */}
                          {myRating !== undefined && !isOwnProfile && (
                            <div
                              className="absolute top-2 left-2 flex items-center gap-1 bg-primary text-black backdrop-blur-md px-1.5 py-0.5 rounded-md shadow-md z-10 text-[9px] font-extrabold border border-black/20"
                              title={`Your rating: ${myRating}/10`}
                            >
                              <span className="leading-none tracking-tight">YOU</span>
                              <span className="leading-none font-bold">★{myRating}</span>
                            </div>
                          )}

                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                            <p className="text-[10px] text-white font-bold line-clamp-2 leading-tight">{displayTitle}</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-on-surface-variant glass-card rounded-2xl border border-white/5 p-8">
                    <span className="material-symbols-outlined text-[36px] opacity-30 mb-2">bookmark_border</span>
                    <p className="text-sm">
                      {selectedWatchlistGenres.length > 0
                        ? "No titles match the selected genre filters."
                        : `No ${watchlistMediaFilter === "tv" ? "TV shows" : "movies"} in the watchlist.`}
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* TAB 3: REVIEWS */}
            {activeProfileTab === "reviews" && (
              <section className="animate-fade-in space-y-6">
                {/* Media Switcher: Movies vs TV Shows */}
                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={() => setMediaFilter("movie")}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                      mediaFilter === "movie"
                        ? "bg-[#e50914] text-white border-[#e50914] shadow-[0_0_12px_rgba(229,9,20,0.4)]"
                        : "bg-white/5 text-on-surface-variant border-white/10 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">movie</span>
                    Movies ({reviewsMovies.length})
                  </button>
                  <button
                    onClick={() => setMediaFilter("tv")}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                      mediaFilter === "tv"
                        ? "bg-[#a855f7] text-white border-[#a855f7] shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                        : "bg-white/5 text-on-surface-variant border-white/10 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">tv</span>
                    TV Shows ({reviewsTv.length})
                  </button>
                </div>

                {currentReviews.length > 0 ? (
                  <div className="space-y-4">
                    {currentReviews.map((rev: any) => {
                      const type = rev.content_type === "tv" ? "tv" : "movie";
                      const detail = mediaDetails[`${type}_${rev.movie_id}`] || mediaDetails[rev.movie_id];
                      const userRating = ratingsMap[`${type}_${rev.movie_id}`] ?? ratingsMap[rev.movie_id];
                      const displayTitle = detail?.title || detail?.name || rev.movie_title || "Untitled";
                      const posterUrl = getPosterUrl({
                        movieId: rev.movie_id,
                        contentType: type,
                        defaultPosterPath: rev.poster_path || detail?.poster_path,
                        posterPrefs,
                        size: "w185",
                      });

                      return (
                        <ReviewCard
                          key={rev.id}
                          review={rev}
                          userRating={userRating}
                          movieTitle={displayTitle}
                          posterPath={posterUrl}
                          avatarUrl={profile.avatar_url}
                          currentUserId={currentUser?.id}
                          currentUserName={currentUser?.name || currentUser?.email || undefined}
                          currentUserAvatar={currentUser?.image || undefined}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-on-surface-variant glass-card rounded-2xl border border-white/5 p-8">
                    <span className="material-symbols-outlined text-[36px] opacity-30 mb-2">rate_review</span>
                    <p className="text-sm">No reviews written for {mediaFilter === "tv" ? "TV shows" : "movies"} yet.</p>
                  </div>
                )}
              </section>
            )}

            {/* TAB 4: LISTS */}
            {activeProfileTab === "lists" && (
              <section className="animate-fade-in">
                {publicLists.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {publicLists.map((list) => {
                      const items = list.items || [];
                      const previewPosters = items.slice(0, 4);
                      return (
                        <Link
                          key={list.id}
                          href={`/lists/${list.id}`}
                          className="group flex items-center gap-4 glass-card rounded-2xl border border-white/10 overflow-hidden hover:border-primary/40 transition-all duration-300 p-4"
                        >
                          <div className="flex-shrink-0 grid grid-cols-2 w-24 h-16 rounded-xl overflow-hidden gap-0.5 bg-black/40">
                            {previewPosters.length > 0 ? (
                              previewPosters.map((item: any, i: number) => (
                                <div key={i} className="overflow-hidden bg-white/5">
                                  <img
                                    src={item.poster_path ? `https://image.tmdb.org/t/p/w92${item.poster_path}` : "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=92"}
                                    alt={item.movie_title}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ))
                            ) : (
                              <div className="col-span-2 flex items-center justify-center bg-white/5">
                                <span className="material-symbols-outlined text-white/20 text-xl">playlist_play</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              {list.is_ranked && (
                                <span className="text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-[#e9c349]/20 text-[#e9c349] border border-[#e9c349]/30">
                                  Ranked
                                </span>
                              )}
                              <h4 className="font-serif font-bold text-base text-on-surface group-hover:text-primary transition-colors truncate">
                                {list.title}
                              </h4>
                            </div>
                            {list.description && <p className="text-xs text-on-surface-variant truncate">{list.description}</p>}
                            <p className="text-[11px] text-on-surface-variant/60 mt-1 font-mono">
                              {list.item_count ?? items.length} {((list.item_count ?? items.length) === 1 ? "entry" : "entries")}
                            </p>
                          </div>
                          <span className="material-symbols-outlined text-on-surface-variant/40 text-base flex-shrink-0">chevron_right</span>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-on-surface-variant glass-card rounded-2xl border border-white/5 p-8">
                    <span className="material-symbols-outlined text-[36px] opacity-30 mb-2">playlist_add</span>
                    <p className="text-sm">No public lists created yet.</p>
                  </div>
                )}
              </section>
            )}
              </>
            )}
          </>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-[60px] z-50 mb-4 mx-4 rounded-full bg-surface/40 backdrop-blur-[100px] border border-white/10 flex justify-around items-center px-6 shadow-[0_0_20px_rgba(255,180,170,0.1)] max-w-md md:left-1/2 md:-translate-x-1/2">
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/"><span className="material-symbols-outlined">home</span></Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/recommendations"><span className="material-symbols-outlined">search</span></Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/movies"><span className="material-symbols-outlined">bookmark</span></Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/community"><span className="material-symbols-outlined">group</span></Link>
        <Link className="flex items-center justify-center text-primary relative after:content-[''] after:absolute after:-bottom-2 after:w-1 after:h-1 after:bg-primary after:rounded-full after:shadow-[0_0_8px_#ffb4aa] active:scale-90" href="/profile"><span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>person</span></Link>
      </nav>

      {/* Follow List Modal */}
      {followListModal && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setFollowListModal(null)}
        >
          <div
            className="bg-[#131313] border border-white/10 rounded-t-3xl w-full max-w-md max-h-[75vh] overflow-hidden flex flex-col shadow-[0_-8px_40px_rgba(0,0,0,0.6)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h3 className="font-serif text-lg text-on-surface capitalize">
                {followListModal.type === "followers" ? `${followCounts.followers} Followers` : `${followCounts.following} Following`}
              </h3>
              <button onClick={() => setFollowListModal(null)} className="text-on-surface-variant hover:text-white transition-colors cursor-pointer bg-transparent border-none">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 py-2">
              {followListModal.loading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : followListModal.users.length === 0 ? (
                <p className="text-center text-on-surface-variant text-sm py-8">No users found.</p>
              ) : (
                followListModal.users.map((u: any) => (
                  <Link
                    key={u.user_id}
                    href={`/profile/${u.user_id}`}
                    onClick={() => setFollowListModal(null)}
                    className="flex items-center gap-3 px-6 py-3 hover:bg-white/5 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full overflow-hidden border border-white/10 bg-white/5 flex-shrink-0">
                      {u.avatar_url ? (
                        <img src={getSafeAvatarUrl(u.avatar_url) || ""} alt={u.display_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-primary font-bold text-xs uppercase bg-primary/20">
                          {(u.display_name || "?").slice(0, 2)}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-on-surface">{u.display_name}</p>
                      {u.username && <p className="text-xs text-on-surface-variant font-mono">@{u.username}</p>}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Avatar Enlarged Modal */}
      {avatarModalOpen && profile?.avatar_url && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in"
          onClick={() => setAvatarModalOpen(false)}
        >
          <div className="relative max-w-sm w-full flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl bg-white/5">
              <img src={getSafeAvatarUrl(profile.avatar_url) || ""} alt={profile.display_name} className="w-full h-full object-cover" />
            </div>
            <p className="text-sm font-serif font-bold text-white">{profile.display_name}</p>
            <button
              onClick={() => setAvatarModalOpen(false)}
              className="px-6 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all cursor-pointer border border-white/10"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
