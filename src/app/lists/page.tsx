"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import NotificationBell from "@/components/NotificationBell";
import { useToast } from "@/components/ToastProvider";
import { getAvatarUrlOrDefault } from "@/lib/avatar";

interface CustomList {
  id: string;
  user_id: string;
  title: string;
  description: string;
  is_ranked: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  items?: any[];
  item_count?: number;
}

export default function ListsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user as any;
  const { showToast } = useToast();

  const [lists, setLists] = useState<CustomList[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  // Create list modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isRanked, setIsRanked] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);

  // Delete confirm state
  const [deletingListId, setDeletingListId] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const fetchLists = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/lists?userId=${encodeURIComponent(user.id)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setLists(data);
        }
      }
    } catch (err) {
      console.error("Error loading lists:", err);
      showToast("Failed to load lists");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
  }, [user]);

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !title.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          title: title.trim(),
          description: description.trim(),
          is_ranked: isRanked,
          is_public: isPublic,
        }),
      });

      if (res.ok) {
        const newList = await res.json();
        showToast(`Created list "${newList.title}"!`);
        setShowCreateModal(false);
        setTitle("");
        setDescription("");
        setIsRanked(false);
        setIsPublic(true);
        fetchLists();
        router.push(`/lists/${newList.id}`);
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to create list");
      }
    } catch (err) {
      console.error("Error creating list:", err);
      showToast("Error creating list");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteList = async (listId: string) => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/lists?listId=${listId}&userId=${user.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast("List deleted");
        setLists((prev) => prev.filter((l) => l.id !== listId));
        setDeletingListId(null);
      } else {
        showToast("Failed to delete list");
      }
    } catch (err) {
      console.error("Error deleting list:", err);
      showToast("Error deleting list");
    }
  };

  return (
    <div className="bg-[#050505] text-[#e5e2e1] font-body-md overflow-x-clip min-h-screen relative pb-32">
      {/* Header */}
      <header
        className={`fixed top-0 left-0 w-full z-50 flex justify-between items-center px-container-margin transition-all duration-300 ${
          scrolled
            ? "py-stack-sm bg-[#131313]/90 backdrop-blur-md border-b border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]"
            : "py-stack-md bg-gradient-to-b from-[#050505]/90 via-[#050505]/40 to-transparent border-none"
        }`}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors text-sm font-semibold"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Profile
          </Link>
        </div>

        <Link href="/" className="hover:opacity-90 transition-all block">
          <h1 className="font-display-md text-[24px] text-primary tracking-tighter uppercase select-none font-serif drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
            CINE SOCIAL
          </h1>
        </Link>

        <div className="flex items-center gap-3">
          <NotificationBell />
          {user && (
            <Link
              href="/profile"
              className="w-8 h-8 rounded-full overflow-hidden border border-white/10 hover:opacity-80 transition-all focus:outline-none flex items-center justify-center bg-white/5"
            >
              {user.image ? (
                <img
                  alt={user.name || "User"}
                  className="w-full h-full object-cover"
                  src={getAvatarUrlOrDefault(user.image)}
                />
              ) : (
                <span className="material-symbols-outlined text-on-surface-variant text-base">person</span>
              )}
            </Link>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-28 md:pt-36 px-container-margin max-w-screen-xl mx-auto space-y-8 animate-fade-in">
        {/* Page Hero Title & Create Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary text-2xl">format_list_bulleted</span>
              <h2 className="font-serif text-3xl font-black text-on-surface">Custom Lists</h2>
            </div>
            <p className="text-on-surface-variant text-sm">
              Create, rank, and curate collections of films and TV shows to share with fellow cinephiles.
            </p>
          </div>

          <button
            onClick={() => {
              if (!user?.id) {
                router.push(`/auth/signin?callbackUrl=${encodeURIComponent("/lists")}`);
                return;
              }
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-black font-bold text-sm hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,180,170,0.25)] border-none cursor-pointer self-start sm:self-auto"
          >
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
              add_circle
            </span>
            Create New List
          </button>
        </div>

        {/* Lists Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4 animate-skeleton-pulse"
              >
                <div className="h-6 bg-white/15 rounded-md w-3/4"></div>
                <div className="h-4 bg-white/10 rounded w-1/2"></div>
                <div className="grid grid-cols-4 gap-2 pt-2">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="aspect-[2/3] bg-white/10 rounded-lg"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : !user ? (
          <div className="glass-panel rounded-2xl border border-white/10 p-12 text-center max-w-lg mx-auto space-y-4">
            <span className="material-symbols-outlined text-[48px] text-primary">lock</span>
            <h3 className="font-serif text-xl font-bold text-on-surface">Sign in to build custom lists</h3>
            <p className="text-on-surface-variant text-sm">
              Organize your favorite movies and TV shows into ranked or unranked Letterboxd-style lists.
            </p>
            <Link
              href="/auth/signin?callbackUrl=/lists"
              className="inline-block px-6 py-2.5 rounded-full bg-primary text-black font-bold text-sm hover:brightness-110 active:scale-95 transition-all"
            >
              Sign In
            </Link>
          </div>
        ) : lists.length === 0 ? (
          <div className="glass-panel rounded-2xl border border-white/10 p-12 text-center max-w-lg mx-auto space-y-4">
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">
              playlist_add
            </span>
            <h3 className="font-serif text-xl font-bold text-on-surface">No lists created yet</h3>
            <p className="text-on-surface-variant text-sm">
              Start building your first custom film or TV collection today.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2.5 rounded-full bg-primary text-black font-bold text-sm hover:brightness-110 active:scale-95 transition-all border-none cursor-pointer"
            >
              Create your first list
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lists.map((list) => {
              const previewItems = (list.items || []).slice(0, 4);
              return (
                <div
                  key={list.id}
                  className="glass-panel rounded-2xl border border-white/10 p-5 hover:border-primary/40 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden"
                >
                  <div className="space-y-3 mb-4">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/lists/${list.id}`} className="block flex-1">
                        <h3 className="font-serif text-lg font-bold text-on-surface group-hover:text-primary transition-colors leading-snug">
                          {list.title}
                        </h3>
                      </Link>

                      <div className="flex items-center gap-1 shrink-0">
                        {list.is_ranked && (
                          <span className="text-[10px] bg-secondary/20 text-secondary border border-secondary/30 px-2 py-0.5 rounded-full font-mono font-bold uppercase">
                            Ranked
                          </span>
                        )}
                        <button
                          onClick={() => setDeletingListId(list.id)}
                          className="text-on-surface-variant/40 hover:text-red-400 p-1 transition-colors cursor-pointer bg-transparent border-none"
                          title="Delete list"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>

                    {list.description && (
                      <p className="text-on-surface-variant text-xs line-clamp-2 leading-relaxed">
                        {list.description}
                      </p>
                    )}

                    <div className="text-[11px] text-on-surface-variant/70 font-mono">
                      {list.item_count ?? previewItems.length} {(list.item_count ?? previewItems.length) === 1 ? "entry" : "entries"}
                    </div>
                  </div>

                  {/* 4-Item Poster Preview Stack */}
                  <Link href={`/lists/${list.id}`} className="block">
                    <div className="grid grid-cols-4 gap-2 bg-black/40 p-2 rounded-xl border border-white/5 group-hover:border-white/10 transition-colors">
                      {Array.from({ length: 4 }).map((_, idx) => {
                        const item = previewItems[idx];
                        return (
                          <div
                            key={idx}
                            className="aspect-[2/3] rounded-lg overflow-hidden bg-white/5 border border-white/5 relative flex items-center justify-center text-white/20"
                          >
                            {item?.poster_path ? (
                              <img
                                src={`https://image.tmdb.org/t/p/w185${item.poster_path}`}
                                alt={item.movie_title || "Poster"}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <span className="material-symbols-outlined text-xs">movie</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create List Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="glass-panel w-full max-w-md rounded-2xl border border-white/10 p-6 space-y-5 shadow-2xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">playlist_add</span>
                <h3 className="font-serif text-lg font-bold text-on-surface">Create New List</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-on-surface-variant hover:text-white transition-colors cursor-pointer bg-transparent border-none"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateList} className="space-y-4">
              <div>
                <label className="text-xs text-on-surface-variant uppercase tracking-widest font-semibold block mb-1">
                  List Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2026 Must Watch, Sci-Fi Masterpieces..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  autoFocus
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-on-surface text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-on-surface-variant/40"
                />
              </div>

              <div>
                <label className="text-xs text-on-surface-variant uppercase tracking-widest font-semibold block mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="What is this list about?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-on-surface text-sm focus:outline-none focus:border-primary/50 transition-all resize-none placeholder:text-on-surface-variant/40"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer text-sm text-on-surface-variant select-none">
                  <input
                    type="checkbox"
                    checked={isRanked}
                    onChange={(e) => setIsRanked(e.target.checked)}
                    className="rounded accent-primary w-4 h-4 cursor-pointer"
                  />
                  <span>Ranked list (shows numbered order 1, 2, 3...)</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-sm text-on-surface-variant select-none">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="rounded accent-primary w-4 h-4 cursor-pointer"
                  />
                  <span>Public list (visible on your public profile)</span>
                </label>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="submit"
                  disabled={creating || !title.trim()}
                  className="flex-1 py-3 rounded-full bg-primary text-black font-bold text-sm hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,180,170,0.25)] border-none cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">add_circle</span>
                      Create List
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-3 rounded-full border border-white/10 text-on-surface-variant text-sm hover:text-white transition-colors cursor-pointer bg-transparent"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingListId && (
        <div
          className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setDeletingListId(null)}
        >
          <div
            className="glass-panel w-full max-w-sm rounded-2xl border border-red-500/20 p-6 space-y-4 shadow-2xl animate-scale-up text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">delete_forever</span>
            </div>
            <h3 className="font-serif text-lg font-bold text-on-surface">Delete this list?</h3>
            <p className="text-on-surface-variant text-xs">
              This action cannot be undone. All entries within this list will be removed.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleDeleteList(deletingListId)}
                className="flex-1 py-2.5 rounded-full bg-red-500 text-white font-bold text-xs hover:bg-red-600 active:scale-95 transition-all cursor-pointer border-none"
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setDeletingListId(null)}
                className="px-4 py-2.5 rounded-full border border-white/10 text-on-surface-variant text-xs hover:text-white transition-colors cursor-pointer bg-transparent"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 h-[60px] z-50 mb-container-margin mx-container-margin rounded-full bg-surface/40 backdrop-blur-[100px] border border-white/10 flex justify-around items-center px-6 shadow-[0_0_20px_rgba(255,180,170,0.1)] max-w-md md:left-1/2 md:-translate-x-1/2">
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/"><span className="material-symbols-outlined">home</span></Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/recommendations"><span className="material-symbols-outlined">search</span></Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/movies"><span className="material-symbols-outlined">bookmark</span></Link>
        <Link className="flex items-center justify-center text-on-surface-variant opacity-60 hover:text-primary transition-colors active:scale-90" href="/community"><span className="material-symbols-outlined">group</span></Link>
        <Link className="flex items-center justify-center text-primary relative after:content-[''] after:absolute after:-bottom-2 after:w-1 after:h-1 after:bg-primary after:rounded-full after:shadow-[0_0_8px_#ffb4aa] active:scale-90" href="/profile"><span className="material-symbols-outlined">person</span></Link>
      </nav>
    </div>
  );
}
