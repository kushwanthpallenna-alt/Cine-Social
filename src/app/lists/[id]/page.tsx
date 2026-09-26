"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import NotificationBell from "@/components/NotificationBell";
import { useToast } from "@/components/ToastProvider";
import { getAvatarUrlOrDefault } from "@/lib/avatar";

interface ListItem {
  id: string;
  list_id: string;
  movie_id: string;
  movie_title: string;
  poster_path: string;
  content_type: string;
  position: number;
  notes: string;
  added_at: string;
}

interface ListData {
  id: string;
  user_id: string;
  title: string;
  description: string;
  is_ranked: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  items: ListItem[];
  owner?: {
    display_name?: string;
    username?: string;
    avatar_url?: string;
  };
}

export default function ListDetailPage() {
  const router = useRouter();
  const params = useParams();
  const listId = params?.id as string;
  const { data: session } = useSession();
  const user = session?.user as any;
  const { showToast } = useToast();

  const [list, setList] = useState<ListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  // Search & Add Title Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingMovieId, setAddingMovieId] = useState<string | null>(null);
  const [itemNote, setItemNote] = useState("");

  // Edit List Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsRanked, setEditIsRanked] = useState(false);
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete List Confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const fetchList = async () => {
    if (!listId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/lists?listId=${listId}`);
      if (res.ok) {
        const data = await res.json();
        setList(data);
        setEditTitle(data.title || "");
        setEditDescription(data.description || "");
        setEditIsRanked(!!data.is_ranked);
        setEditIsPublic(data.is_public !== false);
      } else {
        showToast("List not found");
      }
    } catch (err) {
      console.error("Error fetching list:", err);
      showToast("Error loading list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [listId]);

  // Debounced search for adding titles
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tmdb?endpoint=search/multi&query=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          const filtered = (data.results || []).filter(
            (item: any) => item.media_type === "movie" || item.media_type === "tv"
          );
          setSearchResults(filtered);
        }
      } catch (e) {
        console.error("Error searching TMDB:", e);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const isOwner = user?.id && list?.user_id && String(user.id) === String(list.user_id);

  const handleAddItem = async (item: any) => {
    if (!listId) return;
    const movieId = String(item.id);
    const isTv = item.media_type === "tv" || (item.name && !item.title);
    const contentType = isTv ? "tv" : "movie";
    const title = item.title || item.name || "Untitled";
    const posterPath = item.poster_path || "";

    setAddingMovieId(movieId);
    try {
      const res = await fetch("/api/list-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          list_id: listId,
          movie_id: movieId,
          movie_title: title,
          poster_path: posterPath,
          content_type: contentType,
          notes: itemNote.trim(),
        }),
      });

      if (res.ok) {
        const newItem = await res.json();
        setList((prev) => (prev ? { ...prev, items: [...(prev.items || []), newItem] } : prev));
        showToast(`Added "${title}" to list!`);
        setItemNote("");
      } else {
        const err = await res.json();
        if (res.status === 409) {
          showToast(`"${title}" is already in this list.`);
        } else {
          showToast(err.error || "Failed to add item");
        }
      }
    } catch (err) {
      console.error("Error adding item:", err);
      showToast("Error adding item");
    } finally {
      setAddingMovieId(null);
    }
  };

  const handleRemoveItem = async (itemId: string, itemTitle: string) => {
    try {
      const res = await fetch(`/api/list-items?itemId=${itemId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setList((prev) =>
          prev
            ? {
                ...prev,
                items: (prev.items || []).filter((it) => it.id !== itemId),
              }
            : prev
        );
        showToast(`Removed "${itemTitle}"`);
      } else {
        showToast("Failed to remove item");
      }
    } catch (err) {
      console.error("Error deleting item:", err);
      showToast("Error deleting item");
    }
  };

  const handleSaveEditList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listId || !editTitle.trim() || !user?.id) return;
    setSavingEdit(true);
    try {
      const res = await fetch("/api/lists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          list_id: listId,
          user_id: user.id,
          title: editTitle.trim(),
          description: editDescription.trim(),
          is_ranked: editIsRanked,
          is_public: editIsPublic,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setList((prev) => (prev ? { ...prev, ...updated } : prev));
        showToast("List updated!");
        setShowEditModal(false);
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to update list");
      }
    } catch (err) {
      console.error("Error updating list:", err);
      showToast("Error updating list");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteList = async () => {
    if (!listId || !user?.id) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/lists?listId=${listId}&userId=${user.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast("List deleted");
        router.push("/lists");
      } else {
        showToast("Failed to delete list");
      }
    } catch (err) {
      console.error("Error deleting list:", err);
      showToast("Error deleting list");
    } finally {
      setDeleting(false);
    }
  };

  const handleShareList = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      showToast("List link copied to clipboard!");
    }
  };

  if (loading) {
    return (
      <div className="bg-[#050505] text-[#e5e2e1] min-h-screen pt-32 px-container-margin max-w-screen-xl mx-auto space-y-6 animate-skeleton-pulse">
        <div className="h-8 bg-white/15 rounded-xl w-1/3"></div>
        <div className="h-4 bg-white/10 rounded w-1/2"></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 pt-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-white/10 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="bg-[#050505] text-[#e5e2e1] min-h-screen flex flex-col items-center justify-center p-6 gap-4">
        <span className="material-symbols-outlined text-[48px] text-primary">error</span>
        <h2 className="font-serif text-2xl font-bold">List Not Found</h2>
        <p className="text-on-surface-variant text-sm">This list may have been deleted or is set to private.</p>
        <Link
          href="/lists"
          className="px-6 py-2.5 rounded-full bg-primary text-black font-bold text-sm hover:brightness-110"
        >
          Back to Lists
        </Link>
      </div>
    );
  }

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
            href="/lists"
            className="flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors text-sm font-semibold"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            All Lists
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

      {/* Main Container */}
      <main className="pt-28 md:pt-36 px-container-margin max-w-screen-xl mx-auto space-y-8 animate-fade-in">
        {/* List Header Card */}
        <div className="glass-panel p-6 md:p-8 rounded-2xl border border-white/10 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                {list.is_ranked && (
                  <span className="text-[10px] bg-secondary/20 text-secondary border border-secondary/30 px-2 py-0.5 rounded-full font-mono font-bold uppercase">
                    Ranked List
                  </span>
                )}
                {!list.is_public && (
                  <span className="text-[10px] bg-white/10 text-on-surface-variant px-2 py-0.5 rounded-full uppercase font-bold">
                    Private
                  </span>
                )}
                <span className="text-xs text-on-surface-variant/70 font-mono">
                  {(list.items || []).length} {list.items?.length === 1 ? "film/show" : "films & shows"}
                </span>
              </div>

              <h2 className="font-serif text-3xl sm:text-4xl font-black text-on-surface tracking-tight">
                {list.title}
              </h2>

              {list.description && (
                <p className="text-on-surface-variant text-sm md:text-base leading-relaxed">
                  {list.description}
                </p>
              )}
            </div>

            {/* Actions Row */}
            <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
              <button
                onClick={handleShareList}
                className="px-4 py-2 rounded-full glass-card text-xs font-bold text-on-surface hover:text-primary hover:border-primary/40 transition-all flex items-center gap-1.5 cursor-pointer border border-white/10"
              >
                <span className="material-symbols-outlined text-sm">share</span>
                Share
              </button>

              {isOwner && (
                <>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="px-5 py-2 rounded-full bg-primary text-black text-xs font-bold hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer border-none shadow-[0_0_15px_rgba(255,180,170,0.25)]"
                  >
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                      add_circle
                    </span>
                    Add Title
                  </button>

                  <button
                    onClick={() => setShowEditModal(true)}
                    className="px-4 py-2 rounded-full glass-card text-xs font-bold text-on-surface-variant hover:text-white transition-all flex items-center gap-1 cursor-pointer border border-white/10"
                    title="Edit list details"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                    Edit
                  </button>

                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="p-2 rounded-full glass-card text-on-surface-variant/60 hover:text-red-400 hover:border-red-500/30 transition-all flex items-center justify-center cursor-pointer border border-white/10"
                    title="Delete list"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* List Items Grid */}
        {list.items && list.items.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-stack-md animate-fade-in">
            {list.items.map((item, idx) => {
              const isTv = item.content_type === "tv";
              const linkHref = isTv ? `/tv?id=${item.movie_id}` : `/movies?id=${item.movie_id}`;

              return (
                <div key={item.id} className="group/item relative flex flex-col space-y-1.5">
                  <Link href={linkHref} className="block relative aspect-[2/3] rounded-xl overflow-hidden glass-panel border border-white/10 bg-white/5 hover:border-primary/40 transition-all duration-300">
                    <img
                      src={
                        item.poster_path
                          ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
                          : "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500"
                      }
                      alt={item.movie_title}
                      className="w-full h-full object-cover group-hover/item:scale-105 transition-transform duration-500"
                    />

                    {/* Ranked badge */}
                    {list.is_ranked && (
                      <div className="absolute top-2 left-2 z-10 w-7 h-7 rounded-full bg-secondary text-black font-serif font-black text-xs flex items-center justify-center shadow-lg">
                        {idx + 1}
                      </div>
                    )}

                    {/* Content Type pill */}
                    <div className="absolute bottom-2 left-2 z-10">
                      <span
                        className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded backdrop-blur-md border ${
                          isTv
                            ? "bg-purple-900/80 text-purple-200 border-purple-500/40"
                            : "bg-red-950/80 text-red-200 border-red-500/40"
                        }`}
                      >
                        {isTv ? "TV" : "Film"}
                      </span>
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity" />
                  </Link>

                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0 flex-1">
                      <Link href={linkHref} className="block font-semibold text-sm text-on-surface truncate group-hover/item:text-primary transition-colors">
                        {item.movie_title}
                      </Link>
                      {item.notes && (
                        <p className="text-[11px] text-on-surface-variant/70 italic line-clamp-2 mt-0.5">
                          "{item.notes}"
                        </p>
                      )}
                    </div>

                    {isOwner && (
                      <button
                        onClick={() => handleRemoveItem(item.id, item.movie_title)}
                        className="text-on-surface-variant/30 hover:text-red-400 p-0.5 transition-colors cursor-pointer bg-transparent border-none"
                        title="Remove from list"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass-panel rounded-2xl border border-white/10 p-12 text-center max-w-lg mx-auto space-y-4">
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">
              movie
            </span>
            <h3 className="font-serif text-xl font-bold text-on-surface">This list is empty</h3>
            <p className="text-on-surface-variant text-sm">
              {isOwner ? "Search and add movies or TV shows to start curating." : "No titles have been added yet."}
            </p>
            {isOwner && (
              <button
                onClick={() => setShowAddModal(true)}
                className="px-6 py-2.5 rounded-full bg-primary text-black font-bold text-sm hover:brightness-110 active:scale-95 transition-all border-none cursor-pointer"
              >
                Add first title
              </button>
            )}
          </div>
        )}
      </main>

      {/* Add Title Modal */}
      {showAddModal && isOwner && (
        <div
          className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="glass-panel w-full max-w-lg max-h-[85vh] rounded-2xl border border-white/10 p-6 flex flex-col shadow-2xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">playlist_add</span>
                <h3 className="font-serif text-lg font-bold text-on-surface">Add Title to List</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-on-surface-variant hover:text-white transition-colors cursor-pointer bg-transparent border-none"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Search input */}
            <div className="pt-4 pb-3">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-sm">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search film or TV show..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-10 text-on-surface text-sm focus:outline-none focus:border-primary/50"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-white text-sm bg-transparent border-none cursor-pointer"
                  >
                    close
                  </button>
                )}
              </div>
            </div>

            {/* Optional note for next added item */}
            <div className="pb-3">
              <input
                type="text"
                placeholder="Optional note for item (e.g. Favorite scene, Rewatch note)..."
                value={itemNote}
                onChange={(e) => setItemNote(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-on-surface text-xs focus:outline-none focus:border-primary/50 placeholder:text-on-surface-variant/40"
              />
            </div>

            {/* Search results list */}
            <div className="overflow-y-auto flex-1 space-y-2 pr-1 custom-scrollbar">
              {searching ? (
                <div className="py-8 text-center text-on-surface-variant text-xs space-y-2">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p>Searching titles...</p>
                </div>
              ) : searchQuery.trim() === "" ? (
                <div className="py-8 text-center text-on-surface-variant/50 text-xs">
                  <span className="material-symbols-outlined text-3xl opacity-30 mb-1">search</span>
                  <p>Type above to search TMDB titles</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-8 text-center text-on-surface-variant/60 text-xs">
                  No titles found matching "{searchQuery}"
                </div>
              ) : (
                searchResults.map((item) => {
                  const isTv = item.media_type === "tv" || (item.name && !item.title);
                  const title = item.title || item.name || "Untitled";
                  const year = (item.release_date || item.first_air_date || "").slice(0, 4);
                  const poster = item.poster_path ? `https://image.tmdb.org/t/p/w185${item.poster_path}` : null;
                  const isAdding = addingMovieId === String(item.id);

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                        <div className="w-9 h-13 rounded-lg overflow-hidden bg-white/10 flex-shrink-0 relative">
                          {poster ? (
                            <img src={poster} alt={title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">
                              {isTv ? "tv" : "movie"}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-xs text-on-surface truncate">{title}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                isTv ? "bg-purple-500/20 text-purple-300" : "bg-primary/20 text-primary"
                              }`}
                            >
                              {isTv ? "TV" : "Film"}
                            </span>
                            {year && <span className="text-[10px] text-on-surface-variant/60">{year}</span>}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleAddItem(item)}
                        disabled={isAdding}
                        className="px-3 py-1.5 rounded-full bg-primary text-black font-bold text-xs hover:brightness-110 active:scale-95 transition-all cursor-pointer border-none flex items-center gap-1 shrink-0 disabled:opacity-50"
                      >
                        {isAdding ? (
                          <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-xs">add</span>
                            Add
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit List Modal */}
      {showEditModal && isOwner && (
        <div
          className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="glass-panel w-full max-w-md rounded-2xl border border-white/10 p-6 space-y-4 shadow-2xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-serif text-lg font-bold text-on-surface">Edit List Details</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-on-surface-variant hover:text-white cursor-pointer bg-transparent border-none"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEditList} className="space-y-4">
              <div>
                <label className="text-xs text-on-surface-variant uppercase tracking-widest font-semibold block mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-on-surface text-sm focus:outline-none focus:border-primary/50"
                />
              </div>

              <div>
                <label className="text-xs text-on-surface-variant uppercase tracking-widest font-semibold block mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-on-surface text-sm focus:outline-none focus:border-primary/50 resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-on-surface-variant select-none">
                  <input
                    type="checkbox"
                    checked={editIsRanked}
                    onChange={(e) => setEditIsRanked(e.target.checked)}
                    className="rounded accent-primary w-4 h-4 cursor-pointer"
                  />
                  <span>Ranked list (numbered order)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-on-surface-variant select-none">
                  <input
                    type="checkbox"
                    checked={editIsPublic}
                    onChange={(e) => setEditIsPublic(e.target.checked)}
                    className="rounded accent-primary w-4 h-4 cursor-pointer"
                  />
                  <span>Public list</span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={savingEdit || !editTitle.trim()}
                  className="flex-1 py-2.5 rounded-full bg-primary text-black font-bold text-xs hover:brightness-110 active:scale-95 transition-all cursor-pointer border-none"
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2.5 rounded-full border border-white/10 text-on-surface-variant text-xs hover:text-white cursor-pointer bg-transparent"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && isOwner && (
        <div
          className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="glass-panel w-full max-w-sm rounded-2xl border border-red-500/20 p-6 space-y-4 shadow-2xl text-center animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">delete_forever</span>
            </div>
            <h3 className="font-serif text-lg font-bold text-on-surface">Delete list?</h3>
            <p className="text-on-surface-variant text-xs">
              Are you sure you want to delete <strong className="text-white">"{list.title}"</strong>? This cannot be undone.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleDeleteList}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-full bg-red-500 text-white font-bold text-xs hover:bg-red-600 active:scale-95 transition-all cursor-pointer border-none disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2.5 rounded-full border border-white/10 text-on-surface-variant text-xs hover:text-white cursor-pointer bg-transparent"
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
