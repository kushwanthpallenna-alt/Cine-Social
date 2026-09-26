"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "@/components/ToastProvider";

interface AddToListModalProps {
  isOpen: boolean;
  onClose: () => void;
  movieId: string | number;
  movieTitle: string;
  posterPath?: string;
  contentType?: "movie" | "tv";
  userId?: string;
}

export default function AddToListModal({
  isOpen,
  onClose,
  movieId,
  movieTitle,
  posterPath = "",
  contentType = "movie",
  userId,
}: AddToListModalProps) {
  const { showToast } = useToast();
  const [lists, setLists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingToListId, setAddingToListId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  // Create new list mode inside modal
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIsRanked, setNewIsRanked] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isOpen || !userId) return;
    setLoading(true);
    fetch(`/api/lists?userId=${userId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setLists(data);
      })
      .catch((err) => console.error("Error fetching user lists:", err))
      .finally(() => setLoading(false));
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const handleAddToList = async (listId: string) => {
    if (!userId) return;
    setAddingToListId(listId);
    try {
      const res = await fetch("/api/list-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          list_id: listId,
          movie_id: String(movieId),
          movie_title: movieTitle,
          poster_path: posterPath,
          content_type: contentType,
          notes: notes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          showToast(`"${movieTitle}" is already in this list.`);
        } else {
          showToast(data.error || "Failed to add to list");
        }
      } else {
        showToast(`Added "${movieTitle}" to list!`);
        onClose();
      }
    } catch (err) {
      console.error("Error adding to list:", err);
      showToast("Error adding to list");
    } finally {
      setAddingToListId(null);
    }
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !userId) return;

    setCreating(true);
    try {
      const createRes = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          title: newTitle.trim(),
          description: newDescription.trim(),
          is_ranked: newIsRanked,
          is_public: true,
        }),
      });

      if (!createRes.ok) {
        const errData = await createRes.json();
        throw new Error(errData.error || "Failed to create list");
      }

      const newList = await createRes.json();

      // Add item to newly created list
      await handleAddToList(newList.id);
    } catch (err: any) {
      console.error("Error creating list:", err);
      showToast(err.message || "Failed to create list");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-panel w-full max-w-md rounded-2xl border border-white/10 p-6 space-y-5 overflow-hidden shadow-2xl animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">playlist_add</span>
            <h3 className="font-serif text-lg font-bold text-on-surface">Add to List</h3>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-white transition-colors cursor-pointer bg-transparent border-none p-1"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Target Film/TV Info */}
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10">
          <div className="w-10 h-14 rounded-lg overflow-hidden bg-white/10 flex-shrink-0 relative">
            {posterPath ? (
              <img
                src={`https://image.tmdb.org/t/p/w185${posterPath}`}
                alt={movieTitle}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="material-symbols-outlined text-white/30 text-xs">movie</span>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
              {contentType === "tv" ? "TV Show" : "Movie"}
            </span>
            <p className="font-serif text-sm font-bold text-on-surface truncate">{movieTitle}</p>
          </div>
        </div>

        {/* Optional Notes */}
        <div>
          <label className="text-[11px] text-on-surface-variant uppercase tracking-widest font-semibold block mb-1">
            Notes / Comment (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Rewatched in IMAX, Favorite scene..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-on-surface text-xs focus:outline-none focus:border-primary/50 transition-all placeholder:text-on-surface-variant/40"
          />
        </div>

        {/* Create List toggle vs List of Lists */}
        {showCreateForm ? (
          <form onSubmit={handleCreateAndAdd} className="space-y-3 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">New List</span>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="text-[11px] text-on-surface-variant hover:text-white underline cursor-pointer bg-transparent border-none"
              >
                Cancel
              </button>
            </div>

            <input
              type="text"
              placeholder="List Title (e.g. 2026 Favorites, Cyberpunk Gems)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-on-surface text-sm focus:outline-none focus:border-primary/50"
            />

            <textarea
              rows={2}
              placeholder="Description (optional)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-on-surface text-xs focus:outline-none focus:border-primary/50 resize-none"
            />

            <label className="flex items-center gap-2 cursor-pointer text-xs text-on-surface-variant select-none">
              <input
                type="checkbox"
                checked={newIsRanked}
                onChange={(e) => setNewIsRanked(e.target.checked)}
                className="rounded accent-primary w-4 h-4 cursor-pointer"
              />
              <span>Numbered / Ranked list</span>
            </label>

            <button
              type="submit"
              disabled={creating || !newTitle.trim()}
              className="w-full py-2.5 rounded-full bg-primary text-black font-bold text-xs hover:brightness-110 active:scale-95 transition-all shadow-md cursor-pointer disabled:opacity-50 border-none flex items-center justify-center gap-1.5"
            >
              {creating ? (
                <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  Create & Add
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Your Lists</span>
              <button
                onClick={() => setShowCreateForm(true)}
                className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer bg-transparent border-none"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                New List
              </button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-on-surface-variant text-xs space-y-2">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p>Loading your lists...</p>
              </div>
            ) : lists.length === 0 ? (
              <div className="p-5 text-center bg-white/5 rounded-xl border border-white/10 space-y-2">
                <p className="text-xs text-on-surface-variant">You don't have any custom lists yet.</p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="px-4 py-1.5 rounded-full bg-primary text-black text-xs font-bold hover:brightness-110 cursor-pointer border-none"
                >
                  Create your first list
                </button>
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {lists.map((list) => {
                  const isAdding = addingToListId === list.id;
                  return (
                    <div
                      key={list.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
                    >
                      <div className="min-w-0 flex-1 mr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-serif text-sm font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                            {list.title}
                          </span>
                          {list.is_ranked && (
                            <span className="text-[9px] bg-secondary/20 text-secondary px-1.5 py-0.5 rounded font-mono font-bold uppercase">
                              Ranked
                            </span>
                          )}
                        </div>
                        {list.item_count !== undefined && (
                          <span className="text-[10px] text-on-surface-variant/60">
                            {list.item_count} {list.item_count === 1 ? "item" : "items"}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleAddToList(list.id)}
                        disabled={isAdding}
                        className="px-3 py-1.5 rounded-full bg-primary/20 hover:bg-primary text-primary hover:text-black border border-primary/30 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        {isAdding ? (
                          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-xs">add</span>
                            Add
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
