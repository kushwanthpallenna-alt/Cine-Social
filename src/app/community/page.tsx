"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import ReviewCard from "@/components/ReviewCard";
import { getSafeAvatarUrl } from "@/lib/avatar";
import { getPosterUrl } from "@/lib/poster";
import { getMovieUrl, getTvUrl } from "@/lib/slug";

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-primary font-bold">
      {"★".repeat(Math.round(rating / 2))}{"☆".repeat(5 - Math.round(rating / 2))}
      <span className="text-on-surface-variant text-xs font-normal ml-1">{rating}/10</span>
    </span>
  );
}

function UserAvatar({ displayName, avatarUrl, size = 8 }: { displayName: string; avatarUrl?: string | null; size?: number }) {
  const safeUrl = getSafeAvatarUrl(avatarUrl);
  const initials = displayName?.slice(0, 2).toUpperCase() || "?";
  if (safeUrl) {
    return (
      <img
        src={safeUrl}
        alt={displayName}
        className={`w-${size} h-${size} rounded-full object-cover border border-white/10 flex-shrink-0`}
      />
    );
  }
  return (
    <div className={`w-${size} h-${size} rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs uppercase flex-shrink-0 border border-primary/20`}>
      {initials}
    </div>
  );
}

function FollowButton({ targetUserId, currentUserId }: { targetUserId: string; currentUserId: string }) {
  const { data: session } = useSession();
  const user = session?.user;
  const [following, setFollowing] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) return;
    fetch(`/api/follows?followerId=${currentUserId}&followingId=${targetUserId}`)
      .then((r) => r.json())
      .then((d) => setFollowing(d.isFollowing))
      .catch(() => setFollowing(false));
  }, [currentUserId, targetUserId]);

  if (!currentUserId || currentUserId === targetUserId || following === null) return null;

  const toggle = async () => {
    setLoading(true);
    if (following) {
      await fetch(`/api/follows?followerId=${currentUserId}&followingId=${targetUserId}`, { method: "DELETE" });
      setFollowing(false);
    } else {
      await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          follower_id: currentUserId,
          following_id: targetUserId,
          follower_name: user?.name || user?.email || undefined,
          follower_avatar: user?.image || undefined,
        }),
      });
      setFollowing(true);
    }
    setLoading(false);
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`text-xs px-3 py-1 rounded-full font-semibold transition-all duration-200 cursor-pointer border ${
        following
          ? "border-white/20 text-on-surface-variant hover:border-red-400/40 hover:text-red-400"
          : "border-primary/40 text-primary hover:bg-primary/10"
      } disabled:opacity-50`}
    >
      {loading ? "..." : following ? "Following" : "Follow"}
    </button>
  );
}

export default function CommunityFeed() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [items, setItems] = useState<any[]>([]);
  const [movieDetails, setMovieDetails] = useState<Record<string, any>>({});
  const [posterPrefs, setPosterPrefs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [noFollows, setNoFollows] = useState(false);

  // Filter state with URL persistence
  const [activeFilter, setActiveFilter] = useState<string>("all");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const f = p.get("filter");
      if (f && ["all", "review", "rating", "watchlist", "watched"].includes(f)) {
        setActiveFilter(f);
      }
    }
  }, []);

  // User search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  // Fallback: recent community reviews for users with no follows
  const [communityReviews, setCommunityReviews] = useState<any[]>([]);
  const [communityMovies, setCommunityMovies] = useState<Record<string, any>>({});

  const fetchMovieDetails = useCallback(async (mediaItems: { id: string; contentType: string }[]) => {
    if (!mediaItems || mediaItems.length === 0) return;
    setMovieDetails((prev) => {
      const missing = mediaItems.filter((m) => m.id && !prev[`${m.contentType}_${m.id}`] && !prev[m.id]);
      if (missing.length === 0) return prev;

      // Fire-and-forget: fetch missing details from TMDB and merge into state
      Promise.all(
        missing.map(async ({ id, contentType }) => {
          try {
            const endpoint = contentType === "tv" ? `tv/${id}` : `movie/${id}`;
            const r = await fetch(`/api/tmdb?endpoint=${endpoint}`);
            if (r.ok) {
              const data = await r.json();
              return [`${contentType}_${id}`, id, data] as [string, string, any];
            }
          } catch {}
          return null;
        })
      ).then((results) => {
        const newDetails: Record<string, any> = {};
        results.forEach((entry) => {
          if (entry) {
            newDetails[entry[0]] = entry[2];
            newDetails[entry[1]] = entry[2];
          }
        });
        if (Object.keys(newDetails).length > 0) {
          setMovieDetails((p) => ({ ...p, ...newDetails }));
        }
      });

      return prev;
    });
  }, []);

  const fetchFeed = useCallback(
    async (pageNum: number, filterOverride?: string) => {
      const filterToUse = filterOverride ?? activeFilter;
      if (pageNum === 0) setLoading(true);
      else setLoadingMore(true);

      try {
        if (!user?.id) {
          // Load public community reviews for signed-out users
          setNoFollows(true);
          const { supabase } = await import("@/lib/supabase");
          const { data: revs } = await supabase
            .from("reviews")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(20);
          if (revs) {
            setCommunityReviews(revs);
            const mediaItems = revs.map((r: any) => ({
              id: String(r.movie_id),
              contentType: r.content_type || "movie",
            }));
            const det: Record<string, any> = {};
            await Promise.all(
              mediaItems.map(async ({ id, contentType }: any) => {
                try {
                  const endpoint = contentType === "tv" ? `tv/${id}` : `movie/${id}`;
                  const r = await fetch(`/api/tmdb?endpoint=${endpoint}`);
                  if (r.ok) {
                    const data = await r.json();
                    det[`${contentType}_${id}`] = data;
                    det[id] = data;
                  }
                } catch {}
              })
            );
            setCommunityMovies(det);
          }
          return;
        }

        const res = await fetch(
          `/api/social-feed?userId=${encodeURIComponent(user.id)}&page=${pageNum}&filter=${encodeURIComponent(filterToUse)}`
        );
        const data = await res.json();

        if (pageNum === 0 && (!data.items || data.items.length === 0) && filterToUse === "all") {
          setNoFollows(true);
          // Load fallback community reviews
          const { supabase } = await import("@/lib/supabase");
          const { data: revs } = await supabase
            .from("reviews")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(20);
          if (revs) {
            setCommunityReviews(revs);
            const mediaItems = revs.map((r: any) => ({
              id: String(r.movie_id),
              contentType: r.content_type || "movie",
            }));
            const det: Record<string, any> = {};
            await Promise.all(
              mediaItems.map(async ({ id, contentType }: any) => {
                try {
                  const endpoint = contentType === "tv" ? `tv/${id}` : `movie/${id}`;
                  const r = await fetch(`/api/tmdb?endpoint=${endpoint}`);
                  if (r.ok) {
                    const d = await r.json();
                    det[`${contentType}_${id}`] = d;
                    det[id] = d;
                  }
                } catch {}
              })
            );
            setCommunityMovies(det);
          }
        } else {
          setNoFollows(false);
          if (pageNum === 0) {
            setItems(data.items || []);
          } else {
            setItems((prev) => [...prev, ...(data.items || [])]);
          }
          setHasMore(Boolean(data.hasMore));

          // Fetch TMDB media details
          if (data.items && data.items.length > 0) {
            const mediaItems = data.items.map((i: any) => ({
              id: String(i.movie_id),
              contentType: i.content_type || "movie",
            }));
            fetchMovieDetails(mediaItems);

            // Batch-fetch poster preferences
            fetch("/api/poster-preference/batch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ user_id: user.id, items: mediaItems }),
            })
              .then((r) => r.json())
              .then((prefs) => {
                if (Array.isArray(prefs)) {
                  const map: Record<string, string> = {};
                  prefs.forEach((p) => {
                    const t = p.content_type || "movie";
                    map[`${t}_${p.movie_id}`] = p.poster_path;
                    map[p.movie_id] = p.poster_path;
                  });
                  setPosterPrefs((prev) => ({ ...prev, ...map }));
                }
              })
              .catch(() => {});
          }
        }
      } catch (err) {
        console.error("Feed error:", err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user?.id, activeFilter, fetchMovieDetails]
  );

  useEffect(() => {
    fetchFeed(0, activeFilter);
  }, [user?.id]); // Initial load

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    setPage(0);
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (filter === "all") {
        p.delete("filter");
      } else {
        p.set("filter", filter);
      }
      const newUrl = `${window.location.pathname}${p.toString() ? `?${p.toString()}` : ""}`;
      window.history.replaceState(null, "", newUrl);
    }
    fetchFeed(0, filter);
  };

  // Debounced user search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/user-search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.users || []);
        }
      } catch {}
      finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchFeed(next, activeFilter);
  };

  const getActionText = (item: any) => {
    const movie = movieDetails[`${item.content_type || "movie"}_${item.movie_id}`] || movieDetails[item.movie_id];
    const title = movie?.title || movie?.name || item.movie_title || "a title";
    if (item.type === "rating") return <><span className="text-on-surface-variant">rated </span><span className="text-primary font-medium">{title}</span> <StarRating rating={item.rating} /></>;
    if (item.type === "watchlist") return <><span className="text-on-surface-variant">added </span><span className="text-primary font-medium">{title}</span><span className="text-on-surface-variant"> to watchlist</span></>;
    if (item.type === "watched") return <><span className="text-on-surface-variant">watched </span><span className="text-primary font-medium">{title}</span></>;
    if (item.type === "review") return <><span className="text-on-surface-variant">reviewed </span><span className="text-primary font-medium">{title}</span></>;
  };

  const getTypeIcon = (type: string) => {
    if (type === "rating") return "star";
    if (type === "watchlist") return "bookmark_add";
    if (type === "watched") return "visibility";
    if (type === "review") return "rate_review";
    return "movie";
  };

  const filterEmptyLabels: Record<string, { title: string; subtitle: string; icon: string }> = {
    review: {
      title: "No Reviews Yet",
      subtitle: "When friends you follow write a review, you'll see their thoughts and ratings here.",
      icon: "rate_review",
    },
    watchlist: {
      title: "No Watchlist Activity Yet",
      subtitle: "When friends add movies or TV shows to their watchlist, they'll appear here.",
      icon: "bookmark_add",
    },
    watched: {
      title: "No Watched Activity Yet",
      subtitle: "When friends log titles as watched, you'll see them right here.",
      icon: "visibility",
    },
    rating: {
      title: "No Ratings Yet",
      subtitle: "When friends rate films or TV shows, their scores will be displayed here.",
      icon: "star",
    },
  };

  return (
    <div className="font-body-md text-body-md bg-[#050505] text-[#e5e2e1] min-h-screen relative pb-32 overflow-x-clip">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-50 bg-[#131313]/60 backdrop-blur-[40px] border-b border-white/10 flex justify-between items-center px-container-margin py-stack-md shadow-[0_8px_32px_0_rgba(255,180,170,0.05)]">
        <Link href="/" className="hover:opacity-90 active:scale-98 transition-all block">
          <h1 className="font-display-md text-[24px] text-primary tracking-tighter uppercase select-none font-serif">
            SOCIAL
          </h1>
        </Link>
        <div className="flex items-center gap-stack-md">
          {user && (
            <Link href="/profile" className="w-8 h-8 rounded-full overflow-hidden border border-white/10 hover:opacity-80 transition-all cursor-pointer flex items-center justify-center bg-white/5">
              {getSafeAvatarUrl(user.image) ? (
                <img src={getSafeAvatarUrl(user.image)!} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-primary font-bold text-xs font-serif">
                  {(user.name || user.email || "U").slice(0, 2).toUpperCase()}
                </span>
              )}
            </Link>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-[100px] px-container-margin max-w-screen-xl mx-auto w-full">
        <div className="mb-stack-xl">
          <div className="text-center mb-6">
            <h2 className="font-headline-lg text-headline-md text-on-surface mb-2 tracking-tight font-serif">
              Friends Activity
            </h2>
            <p className="text-on-surface-variant max-w-md mx-auto text-sm">
              {noFollows ? "Discover people to follow — see their activity here." : "What your people are watching."}
            </p>
          </div>

          {/* User Search */}
          <div className="max-w-md mx-auto relative">
            <div className={`flex items-center gap-3 px-4 py-2.5 rounded-full border transition-all duration-200 bg-white/5 ${
              searchFocused ? "border-primary/50 shadow-[0_0_20px_rgba(255,180,170,0.1)]" : "border-white/10 hover:border-white/20"
            }`}>
              {searching
                ? <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
                : <span className="material-symbols-outlined text-on-surface-variant text-[18px] flex-shrink-0">person_search</span>
              }
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                placeholder="Search users by name..."
                className="bg-transparent flex-1 text-sm text-on-surface placeholder-on-surface-variant/40 outline-none"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setSearchResults([]); }} className="text-on-surface-variant hover:text-white transition-colors cursor-pointer flex-shrink-0">
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && searchFocused && (
              <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#131313] border border-white/10 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] overflow-hidden">
                {searchResults.map(u => (
                  <div key={u.user_id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                    <Link href={`/profile/${u.user_id}`} className="flex items-center gap-3 flex-1 min-w-0">
                      {getSafeAvatarUrl(u.avatar_url) ? (
                        <img src={getSafeAvatarUrl(u.avatar_url)!} alt={u.display_name} className="w-9 h-9 rounded-full object-cover border border-white/10 flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary font-bold text-xs">{(u.display_name || u.username || "?").slice(0,2).toUpperCase()}</span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <p className="font-semibold text-sm text-on-surface truncate">
                            {u.display_name || u.username || "Cine Member"}
                          </p>
                          <span className="text-xs text-primary/90 bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded font-mono font-medium flex-shrink-0">
                            @{u.username || (u.display_name ? u.display_name.toLowerCase().replace(/\s+/g, "") : "user")}
                          </span>
                        </div>
                      </div>
                    </Link>
                    {user && <FollowButton targetUserId={u.user_id} currentUserId={user.id} />}
                  </div>
                ))}
              </div>
            )}

            {/* No results */}
            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && searchFocused && (
              <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#131313] border border-white/10 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] px-4 py-4 text-center">
                <span className="material-symbols-outlined text-on-surface-variant/40 text-[28px]">person_search</span>
                <p className="text-on-surface-variant text-sm mt-1">No users found for &ldquo;{searchQuery}&rdquo;</p>
              </div>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        {!noFollows && (
          <div className="max-w-2xl mx-auto mb-6 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {[
              { id: "all", label: "All Activity", icon: "dynamic_feed" },
              { id: "review", label: "Reviews", icon: "rate_review" },
              { id: "rating", label: "Ratings", icon: "star" },
              { id: "watched", label: "Watched", icon: "visibility" },
              { id: "watchlist", label: "Watchlist", icon: "bookmark_add" },
            ].map((f) => {
              const active = activeFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => handleFilterChange(f.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer flex-shrink-0 border ${
                    active
                      ? "bg-primary text-black border-primary font-bold shadow-[0_0_12px_rgba(255,180,170,0.3)]"
                      : "bg-white/5 border-white/10 text-on-surface-variant hover:text-white hover:border-white/20"
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">{f.icon}</span>
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <div className="max-w-2xl mx-auto space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass-card p-5 rounded-xl border border-white/10 flex gap-4 animate-skeleton-pulse">
                <div className="w-16 h-24 bg-white/10 rounded-lg flex-shrink-0 animate-skeleton-pulse"></div>
                <div className="flex-grow space-y-3 pt-1">
                  <div className="h-4 bg-white/15 rounded-md w-1/2 animate-skeleton-pulse"></div>
                  <div className="h-3 bg-white/10 rounded-md w-1/3 animate-skeleton-pulse"></div>
                  <div className="h-8 bg-white/10 rounded-lg w-full animate-skeleton-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filter Empty State (when user has follows, but this specific filter has no items) */}
        {!loading && !noFollows && items.length === 0 && activeFilter !== "all" && (
          <div className="max-w-2xl mx-auto text-center py-12 glass-card rounded-2xl border border-white/10 p-8">
            <span className="material-symbols-outlined text-[48px] text-primary/60 mb-3">
              {filterEmptyLabels[activeFilter]?.icon || "feed"}
            </span>
            <h3 className="font-serif text-lg font-bold text-on-surface mb-1">
              {filterEmptyLabels[activeFilter]?.title || "No Activity Found"}
            </h3>
            <p className="text-on-surface-variant text-sm max-w-sm mx-auto mb-4">
              {filterEmptyLabels[activeFilter]?.subtitle || "No items in this category yet."}
            </p>
            <button
              onClick={() => handleFilterChange("all")}
              className="px-5 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-on-surface hover:border-primary/40 hover:text-primary transition-all cursor-pointer"
            >
              View All Activity
            </button>
          </div>
        )}

        {/* Activity Feed */}
        {!loading && !noFollows && items.length > 0 && (
          <div className="max-w-2xl mx-auto space-y-4">
            {items.map((item) => {
              const movie = movieDetails[`${item.content_type || "movie"}_${item.movie_id}`] || movieDetails[item.movie_id];
              const posterUrl = getPosterUrl({
                movieId: item.movie_id,
                contentType: item.content_type || "movie",
                defaultPosterPath: item.poster_path || movie?.poster_path,
                posterPrefs,
                size: "w185",
              });
              const isTv = item.content_type === "tv";
              const title = movie?.title || movie?.name || item.movie_title || "Untitled";
              const linkHref = isTv ? getTvUrl(item.movie_id, title) : getMovieUrl(item.movie_id, title);
              return (
                <div key={`${item.type}_${item.id}_${item.created_at}`} className="glass-card p-5 rounded-xl border border-white/10 shadow-lg group hover:border-white/20 transition-all duration-200">
                  <div className="flex gap-4">
                    {/* Movie poster */}
                    <Link href={linkHref} className="w-16 flex-shrink-0">
                      <div className="aspect-[2/3] rounded-lg overflow-hidden border border-white/5 bg-white/5">
                        <img
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          alt={title}
                          src={posterUrl}
                        />
                      </div>
                    </Link>

                    <div className="flex-grow min-w-0">
                      {/* User + action */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <UserAvatar displayName={item.display_name} avatarUrl={item.avatar_url} size={8} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link href={`/profile/${item.user_id}`} className="font-bold text-on-surface text-sm hover:text-primary transition-colors">
                                {item.display_name}
                              </Link>
                              {user && <FollowButton targetUserId={item.user_id} currentUserId={user.id} />}
                            </div>
                            <p className="text-sm mt-0.5">{getActionText(item)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="material-symbols-outlined text-on-surface-variant/40 text-[14px]">{getTypeIcon(item.type)}</span>
                          <span className="text-[10px] text-on-surface-variant opacity-50 whitespace-nowrap">{timeAgo(item.created_at)}</span>
                        </div>
                      </div>

                      {/* Review text preview */}
                      {item.type === "review" && item.review_text && (
                        <div className="mt-2 p-3 bg-white/5 rounded-lg border border-white/5 relative">
                          <span className="material-symbols-outlined absolute -top-2 -left-1 text-primary opacity-30 text-xl">format_quote</span>
                          <p className="text-body-md text-on-surface-variant italic text-sm line-clamp-3">
                            &ldquo;{item.review_text}&rdquo;
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-8 py-3 rounded-full border border-white/20 text-on-surface-variant hover:border-primary/40 hover:text-primary transition-all duration-200 font-semibold text-sm cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {loadingMore ? (
                    <><div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />Loading...</>
                  ) : (
                    <>Load More<span className="material-symbols-outlined text-sm">expand_more</span></>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* No follows — Discover section */}
        {!loading && noFollows && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center py-8 glass-card rounded-xl border border-white/10 mb-8 px-4">
              <span className="material-symbols-outlined text-[42px] text-primary/70 mb-2">group</span>
              <h3 className="font-title-lg text-lg mb-1">
                {user ? "No Friend Activity Yet" : "Welcome to the Cine Social Community"}
              </h3>
              <p className="text-on-surface-variant text-xs max-w-sm mx-auto mb-3">
                {user
                  ? "Search for and follow other film lovers above to see their ratings, reviews, and watchlist activity here."
                  : "Explore what film lovers are watching and reviewing. Search for users or sign in to share your own reviews!"}
              </p>
              {!user && (
                <Link
                  href="/auth/signin"
                  className="inline-block px-5 py-2 bg-primary text-black font-bold rounded-full text-xs hover:opacity-90 transition-opacity no-underline shadow-md"
                >
                  Sign In to Join
                </Link>
              )}
            </div>

            <h3 className="font-title-lg text-xs text-on-surface-variant uppercase tracking-widest mb-4">
              Recent Community Reviews
            </h3>
            <div className="space-y-4">
              {communityReviews.map((rev) => {
                const movie = communityMovies[rev.movie_id];
                return (
                  <ReviewCard
                    key={rev.id}
                    review={rev}
                    currentUserId={user?.id}
                    currentUserName={user?.name}
                    currentUserAvatar={user?.image}
                    movieTitle={movie?.title}
                    posterPath={movie?.poster_path}
                  />
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-[60px] z-50 mb-container-margin mx-container-margin rounded-full bg-surface/40 backdrop-blur-[100px] border border-white/10 flex justify-around items-center px-6 shadow-[0_0_20px_rgba(255,180,170,0.1)] max-w-md md:left-1/2 md:-translate-x-1/2">
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/"><span className="material-symbols-outlined">home</span></Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/recommendations"><span className="material-symbols-outlined">search</span></Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/movies"><span className="material-symbols-outlined">bookmark</span></Link>
        <Link className="flex items-center justify-center text-primary relative after:content-[''] after:absolute after:-bottom-2 after:w-1 after:h-1 after:bg-primary after:rounded-full after:shadow-[0_0_8px_#ffb4aa] active:scale-90" href="/community"><span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>group</span></Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/profile"><span className="material-symbols-outlined">person</span></Link>
      </nav>
    </div>
  );
}
