"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface Notification {
  id: string;
  user_id: string;
  actor_id?: string;
  actor_name?: string;
  actor_avatar?: string;
  type: "follow" | "review_like";
  message: string;
  link?: string;
  read: boolean;
  created_at: string;
}

function timeAgo(dateStr: string): string {
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

function getTypeIcon(type: string) {
  switch (type) {
    case "follow":
      return { icon: "person_add", color: "text-[#38bdf8]", bg: "bg-[#38bdf8]/15 border-[#38bdf8]/30" };
    case "review_like":
      return { icon: "thumb_up", color: "text-[#e50914]", bg: "bg-[#e50914]/15 border-[#e50914]/30" };
    default:
      return { icon: "notifications", color: "text-on-surface-variant", bg: "bg-white/10 border-white/10" };
  }
}

export default function NotificationBell() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/notifications?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {}
  }, [user?.id]);

  // Initial fetch and polling every 30s
  useEffect(() => {
    if (!user?.id) return;
    fetchNotifications();
    pollIntervalRef.current = setInterval(fetchNotifications, 30000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchNotifications, user?.id]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleOpen = async () => {
    setOpen((prev) => !prev);
    if (!open && unreadCount > 0 && user?.id) {
      // Mark all as read after a short delay so user sees them
      setTimeout(async () => {
        try {
          await fetch("/api/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.id }),
          });
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
          setUnreadCount(0);
        } catch {}
      }, 1500);
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.read && user?.id) {
      try {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, notificationId: notif.id }),
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {}
    }
    setOpen(false);
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={handleOpen}
        className="relative material-symbols-outlined text-on-surface-variant hover:text-white hover:opacity-100 opacity-80 transition-all active:scale-90 duration-200 cursor-pointer"
        aria-label="Notifications"
        style={{ fontVariationSettings: unreadCount > 0 ? "'FILL' 1" : "'FILL' 0" }}
      >
        notifications
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-[#e50914] text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none border border-[#050505] animate-bounce-in">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-3 w-80 md:w-96 rounded-2xl bg-[#131313]/95 border border-white/10 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] z-[200] overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#e50914] text-lg">notifications</span>
              <h3 className="font-serif font-bold text-base text-on-surface">Notifications</h3>
            </div>
            {unreadCount > 0 && (
              <span className="text-xs text-[#e9c349] font-semibold">{unreadCount} new</span>
            )}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-3">
                <span className="material-symbols-outlined text-[48px] text-on-surface-variant/20">
                  notifications_off
                </span>
                <p className="text-sm text-on-surface-variant opacity-60">
                  No notifications yet.<br />Follow users & engage with reviews!
                </p>
              </div>
            ) : (
              <div>
                {notifications.map((notif) => {
                  const { icon, color, bg } = getTypeIcon(notif.type);
                  const content = (
                    <div
                      className={`flex items-start gap-3 px-5 py-3.5 transition-colors cursor-pointer border-b border-white/5 last:border-0 ${
                        !notif.read ? "bg-white/[0.04]" : "hover:bg-white/5"
                      }`}
                      onClick={() => handleNotificationClick(notif)}
                    >
                      {/* Avatar or Icon */}
                      <div className="relative flex-shrink-0 mt-0.5">
                        {notif.actor_avatar ? (
                          <img
                            src={notif.actor_avatar}
                            alt={notif.actor_name || ""}
                            className="w-9 h-9 rounded-full object-cover border border-white/10"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-on-surface-variant font-bold text-sm">
                            {(notif.actor_name || "?").slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span
                          className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border border-[#131313] flex items-center justify-center ${bg}`}
                        >
                          <span className={`material-symbols-outlined text-[9px] ${color}`} style={{ fontVariationSettings: "'FILL' 1", fontSize: "10px" }}>
                            {icon}
                          </span>
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${!notif.read ? "text-on-surface font-medium" : "text-on-surface-variant"}`}>
                          {notif.message}
                        </p>
                        <p className="text-[11px] text-on-surface-variant opacity-50 mt-0.5">
                          {timeAgo(notif.created_at)}
                        </p>
                      </div>

                      {/* Unread dot */}
                      {!notif.read && (
                        <div className="w-2 h-2 rounded-full bg-[#e50914] flex-shrink-0 mt-2" />
                      )}
                    </div>
                  );

                  return notif.link ? (
                    <Link key={notif.id} href={notif.link}>
                      {content}
                    </Link>
                  ) : (
                    <div key={notif.id}>{content}</div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-5 py-3 border-t border-white/10 flex justify-between items-center">
              <button
                onClick={async () => {
                  if (!user?.id) return;
                  await fetch("/api/notifications", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: user.id }),
                  });
                  setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                  setUnreadCount(0);
                }}
                className="text-xs text-on-surface-variant hover:text-white transition-colors cursor-pointer bg-transparent border-none"
              >
                Mark all as read
              </button>
              <span className="text-[11px] text-on-surface-variant opacity-40">
                Last 20 shown
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
