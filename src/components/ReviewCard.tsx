"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

export interface ReviewReply {
  id: string;
  review_id: string;
  user_id: string;
  user_name: string;
  reply_text: string;
  created_at: string;
  avatar_url?: string | null;
}

export interface ReviewData {
  id: string;
  user_id: string;
  user_name?: string;
  movie_id?: string;
  movie_title?: string;
  review_text: string;
  created_at: string;
}

interface ReviewCardProps {
  review: ReviewData;
  currentUserId?: string;
  currentUserName?: string;
  currentUserAvatar?: string;
  avatarUrl?: string;
  userRating?: number;
  movieTitle?: string;
  posterPath?: string;
  // Author edit/delete props
  onEdit?: (review: ReviewData) => void;
  onDelete?: (reviewId: string) => void;
  isEditing?: boolean;
  editText?: string;
  setEditText?: (val: string) => void;
  onSaveEdit?: (reviewId: string) => void;
  onCancelEdit?: () => void;
  isEditingSubmitting?: boolean;
  // Custom container class
  className?: string;
}

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

export default function ReviewCard({
  review,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  avatarUrl,
  userRating,
  movieTitle,
  posterPath,
  onEdit,
  onDelete,
  isEditing,
  editText,
  setEditText,
  onSaveEdit,
  onCancelEdit,
  isEditingSubmitting,
  className = "",
}: ReviewCardProps) {
  // Likes state
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);

  // Replies state
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<ReviewReply[]>([]);
  const [repliesLoaded, setRepliesLoaded] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);

  const isOwner = !!(currentUserId && review.user_id === currentUserId);
  const authorName = review.user_name || "Cine Member";
  const displayTitle = movieTitle || review.movie_title;

  // Fetch initial likes info
  useEffect(() => {
    if (!review.id) return;
    let isMounted = true;
    const url = `/api/reviews/likes?reviewId=${review.id}${currentUserId ? `&userId=${currentUserId}` : ""}`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.likesCountMap && data.likesCountMap[review.id] !== undefined) {
          setLikeCount(data.likesCountMap[review.id]);
        }
        if (data.userLikedSet && Array.isArray(data.userLikedSet)) {
          setLiked(data.userLikedSet.includes(review.id));
        }
      })
      .catch((err) => console.error("Error loading likes:", err));
    return () => {
      isMounted = false;
    };
  }, [review.id, currentUserId]);

  // Fetch initial replies info for count
  useEffect(() => {
    if (!review.id) return;
    let isMounted = true;
    fetch(`/api/reviews/replies?reviewId=${review.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.repliesMap && data.repliesMap[review.id]) {
          setReplies(data.repliesMap[review.id]);
          setRepliesLoaded(true);
        }
      })
      .catch((err) => console.error("Error loading replies:", err));
    return () => {
      isMounted = false;
    };
  }, [review.id]);

  // Toggle Like
  const handleToggleLike = async () => {
    if (!currentUserId) {
      alert("Please sign in to like reviews.");
      return;
    }
    if (likeLoading) return;

    // Optimistic UI update
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!prevLiked);
    setLikeCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1);
    setLikeLoading(true);

    try {
      const res = await fetch("/api/reviews/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review_id: review.id,
          user_id: currentUserId,
          author_id: review.user_id,
          movie_title: displayTitle,
          actor_name: currentUserName,
          actor_avatar: currentUserAvatar,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setLiked(data.liked);
        setLikeCount(data.count);
      } else {
        // Revert on error
        setLiked(prevLiked);
        setLikeCount(prevCount);
      }
    } catch (err) {
      console.error("Error toggling like:", err);
      setLiked(prevLiked);
      setLikeCount(prevCount);
    } finally {
      setLikeLoading(false);
    }
  };

  // Submit Reply
  const handlePostReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) {
      alert("Please sign in to reply.");
      return;
    }
    if (!replyText.trim() || replySubmitting) return;

    setReplySubmitting(true);
    try {
      const res = await fetch("/api/reviews/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review_id: review.id,
          user_id: currentUserId,
          user_name: currentUserName || "Cine Member",
          reply_text: replyText.trim(),
          author_id: review.user_id,
          movie_title: displayTitle,
          user_avatar: currentUserAvatar,
        }),
      });

      const data = await res.json();
      if (res.ok && data.reply) {
        setReplies((prev) => [...prev, data.reply]);
        setReplyText("");
        setShowReplies(true);
      } else {
        alert(data.error || "Failed to post reply.");
      }
    } catch (err) {
      console.error("Error posting reply:", err);
    } finally {
      setReplySubmitting(false);
    }
  };

  // Delete Reply
  const handleDeleteReply = async (replyId: string) => {
    if (!currentUserId || !confirm("Delete this reply?")) return;
    try {
      const res = await fetch(`/api/reviews/replies?replyId=${replyId}&userId=${currentUserId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setReplies((prev) => prev.filter((r) => r.id !== replyId));
      }
    } catch (err) {
      console.error("Error deleting reply:", err);
    }
  };

  return (
    <div
      className={`glass-card p-5 md:p-6 rounded-xl relative overflow-hidden border border-white/10 space-y-4 shadow-lg transition-all ${className}`}
    >
      {/* Reviewer Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/profile/${review.user_id}`} className="flex-shrink-0 group">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={authorName}
                width={40}
                height={40}
                loading="lazy"
                sizes="40px"
                className="w-10 h-10 rounded-full object-cover border border-white/10 group-hover:border-primary transition-colors"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-sm uppercase">
                {authorName.slice(0, 2)}
              </div>
            )}
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/profile/${review.user_id}`} className="font-bold text-body-lg text-on-surface hover:text-primary transition-colors">
                {authorName}
              </Link>
              {displayTitle && (
                <span className="text-xs text-on-surface-variant opacity-70">
                  reviewed <span className="text-white font-medium">{displayTitle}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-on-surface-variant opacity-60 mt-0.5">
              <span>{timeAgo(review.created_at)}</span>
              {userRating && (
                <div className="flex items-center gap-1 text-[#e9c349] font-bold">
                  <span>★</span>
                  <span>{userRating}/10</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {posterPath && review.movie_id && (
          <Link href={`/movies?id=${review.movie_id}`} className="w-10 md:w-12 aspect-[2/3] rounded overflow-hidden border border-white/10 flex-shrink-0 hover:opacity-80 transition-opacity relative">
            <Image src={`https://image.tmdb.org/t/p/w185${posterPath}`} alt={displayTitle || "Movie"} fill sizes="(max-width: 768px) 40px, 48px" loading="lazy" className="object-cover" />
          </Link>
        )}
      </div>

      {/* Review Content or Edit Form */}
      {isEditing ? (
        <div className="space-y-3 pt-1">
          <textarea
            value={editText || ""}
            onChange={(e) => setEditText && setEditText(e.target.value)}
            rows={3}
            className="w-full bg-white/5 border border-primary/50 rounded-xl p-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary text-body-md"
          />
          <div className="flex justify-end gap-2">
            {onCancelEdit && (
              <button
                type="button"
                onClick={onCancelEdit}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-white bg-white/5 border border-white/10 cursor-pointer"
              >
                Cancel
              </button>
            )}
            {onSaveEdit && (
              <button
                type="button"
                onClick={() => onSaveEdit(review.id)}
                disabled={isEditingSubmitting || !editText?.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-black bg-primary hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isEditingSubmitting ? (
                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  "Save Changes"
                )}
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-on-surface-variant text-body-md whitespace-pre-wrap leading-relaxed text-sm md:text-base">
          {review.review_text}
        </p>
      )}

      {/* Footer Actions: Like Heart Button & Reply Toggle */}
      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <div className="flex items-center gap-3">
          {/* Like / Heart Button (Cinema Red #e50914) */}
          <button
            onClick={handleToggleLike}
            disabled={likeLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border active:scale-95 ${
              liked
                ? "bg-[#e50914]/15 border-[#e50914]/40 text-[#e50914] shadow-[0_0_12px_rgba(229,9,20,0.25)]"
                : "bg-white/5 border-white/10 text-on-surface-variant hover:text-white hover:bg-white/10"
            }`}
          >
            <span
              className="material-symbols-outlined text-[16px] transition-transform duration-200"
              style={{
                fontVariationSettings: liked ? "'FILL' 1" : "'FILL' 0",
                color: liked ? "#e50914" : "currentColor",
              }}
            >
              favorite
            </span>
            <span>{liked ? "Liked" : "Like"}</span>
            <span className="ml-0.5 opacity-90 font-bold">{likeCount}</span>
          </button>

          {/* Reply Button */}
          <button
            onClick={() => setShowReplies(!showReplies)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
              showReplies
                ? "bg-white/15 border-white/20 text-white"
                : "bg-white/5 border-white/10 text-on-surface-variant hover:text-white hover:bg-white/10"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              chat_bubble
            </span>
            <span>Reply</span>
            {replies.length > 0 && (
              <span className="ml-0.5 opacity-90 font-bold">({replies.length})</span>
            )}
          </button>
        </div>

        {/* Owner Edit / Delete */}
        {isOwner && !isEditing && (
          <div className="flex items-center gap-3">
            {onEdit && (
              <button
                onClick={() => onEdit(review)}
                className="text-xs text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1 cursor-pointer bg-transparent border-none"
              >
                <span className="material-symbols-outlined text-[14px]">edit</span>
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(review.id)}
                className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 cursor-pointer bg-transparent border-none"
              >
                <span className="material-symbols-outlined text-[14px]">delete</span>
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {/* Threaded Sub-Comments (Replies) Section */}
      {showReplies && (
        <div className="pt-2 space-y-3 animate-fade-in">
          {/* List of Replies */}
          <div className="border-l-2 border-[#e50914]/40 pl-3 md:pl-4 space-y-3">
            {replies.length === 0 ? (
              <p className="text-xs text-on-surface-variant opacity-60 italic py-1">
                No replies yet. Be the first to leave a reply!
              </p>
            ) : (
              replies.map((reply) => {
                const isReplyOwner = currentUserId && reply.user_id === currentUserId;
                return (
                  <div key={reply.id} className="bg-white/5 p-3 rounded-xl border border-white/5 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {reply.avatar_url ? (
                          <Image
                            src={reply.avatar_url}
                            alt={reply.user_name}
                            width={20}
                            height={20}
                            loading="lazy"
                            sizes="20px"
                            className="w-5 h-5 rounded-full object-cover border border-white/10"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold uppercase">
                            {reply.user_name?.slice(0, 1) || "U"}
                          </div>
                        )}
                        <span className="font-bold text-on-surface text-xs">{reply.user_name}</span>
                        <span className="text-[10px] text-on-surface-variant opacity-60">
                          {timeAgo(reply.created_at)}
                        </span>
                      </div>

                      {isReplyOwner && (
                        <button
                          onClick={() => handleDeleteReply(reply.id)}
                          className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer bg-transparent border-none"
                          title="Delete reply"
                        >
                          <span className="material-symbols-outlined text-[12px]">delete</span>
                        </button>
                      )}
                    </div>
                    <p className="text-on-surface-variant text-xs whitespace-pre-wrap pl-7">
                      {reply.reply_text}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Inline Reply Input Form */}
          <form onSubmit={handlePostReply} className="flex gap-2 pt-1">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={currentUserId ? "Write a sub-comment reply..." : "Sign in to reply..."}
              disabled={!currentUserId || replySubmitting}
              className="flex-grow bg-white/5 border border-white/10 rounded-full px-4 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-[#e50914]/60 transition-colors"
            />
            <button
              type="submit"
              disabled={!currentUserId || !replyText.trim() || replySubmitting}
              className="px-4 py-2 rounded-full bg-[#e50914] text-white font-bold text-xs hover:bg-[#ff1e27] active:scale-95 transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1"
            >
              {replySubmitting ? (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                "Post"
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
