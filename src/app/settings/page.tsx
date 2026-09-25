"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProvider";

interface ProfilePrefs {
  is_private: boolean;
  notification_preferences: {
    followers: boolean;
    likes: boolean;
    replies: boolean;
  };
  username: string;
  display_name: string;
  password_hash?: string | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const user = session?.user as any;
  const { showToast } = useToast();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/profile");
    }
  };

  const [prefs, setPrefs] = useState<ProfilePrefs | null>(null);
  const [loading, setLoading] = useState(true);

  // Account section state
  const [usernameDraft, setUsernameDraft] = useState("");
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);

  // Password section state
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [savingPwd, setSavingPwd] = useState(false);

  // Privacy state
  const [isPrivate, setIsPrivate] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  // Notification prefs state
  const [notifPrefs, setNotifPrefs] = useState({ followers: true, likes: true, replies: true });
  const [savingNotif, setSavingNotif] = useState(false);

  // Danger zone state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  const isCredentialsUser = user?.id?.startsWith("cred_");

  // Fetch profile preferences on mount
  useEffect(() => {
    if (!user?.id) return;
    const fetchPrefs = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("profiles")
          .select("username, display_name, is_private, notification_preferences, password_hash")
          .eq("user_id", user.id)
          .maybeSingle();

        if (data) {
          setPrefs(data as ProfilePrefs);
          setUsernameDraft(data.username || "");
          setDisplayNameDraft(data.display_name || user.name || "");
          setIsPrivate(!!data.is_private);
          if (data.notification_preferences) {
            setNotifPrefs({
              followers: data.notification_preferences.followers ?? true,
              likes: data.notification_preferences.likes ?? true,
              replies: data.notification_preferences.replies ?? true,
            });
          }
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPrefs();
  }, [user?.id]);

  // Save username / display name
  const handleSaveAccount = async () => {
    if (!user?.id) return;
    setUsernameError(null);
    const clean = usernameDraft.toLowerCase().trim();
    if (isCredentialsUser) {
      if (clean.length < 3 || clean.length > 30) {
        setUsernameError("Username must be 3–30 characters.");
        return;
      }
      if (!/^[a-z0-9_]+$/.test(clean)) {
        setUsernameError("Only letters, numbers, and underscores.");
        return;
      }
    }
    setSavingAccount(true);
    try {
      const updateData: Record<string, string> = {
        display_name: displayNameDraft.trim() || usernameDraft,
        updated_at: new Date().toISOString(),
      };
      if (isCredentialsUser) updateData.username = clean;

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("user_id", user.id);

      if (error) {
        if (error.message.includes("unique") || error.code === "23505") {
          setUsernameError("That username is already taken.");
        } else {
          showToast("Failed to save. Try again.");
        }
      } else {
        showToast("Account updated!");
        await updateSession();
      }
    } catch (err) {
      showToast("Error saving account.");
    } finally {
      setSavingAccount(false);
    }
  };

  // Change password
  const handleChangePassword = async () => {
    setPwdError(null);
    if (!currentPwd || !newPwd || !confirmPwd) {
      setPwdError("All password fields are required.");
      return;
    }
    if (newPwd.length < 6) {
      setPwdError("New password must be at least 6 characters.");
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError("New passwords don't match.");
      return;
    }
    setSavingPwd(true);
    try {
      const res = await fetch("/api/settings/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, currentPassword: currentPwd, newPassword: newPwd }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwdError(data.error || "Failed to change password.");
      } else {
        showToast("Password changed successfully!");
        setCurrentPwd("");
        setNewPwd("");
        setConfirmPwd("");
      }
    } catch {
      setPwdError("Network error.");
    } finally {
      setSavingPwd(false);
    }
  };

  // Save privacy toggle
  const handlePrivacyToggle = async (val: boolean) => {
    if (!user?.id) return;
    setIsPrivate(val);
    setSavingPrivacy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_private: val, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      if (error) {
        setIsPrivate(!val);
        showToast("Failed to save privacy setting.");
      } else {
        showToast(val ? "Profile set to private." : "Profile set to public.");
      }
    } finally {
      setSavingPrivacy(false);
    }
  };

  // Save notification prefs
  const handleNotifToggle = async (key: keyof typeof notifPrefs, val: boolean) => {
    if (!user?.id) return;
    const next = { ...notifPrefs, [key]: val };
    setNotifPrefs(next);
    setSavingNotif(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ notification_preferences: next, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      if (error) {
        setNotifPrefs(notifPrefs);
        showToast("Failed to save notification preferences.");
      }
    } finally {
      setSavingNotif(false);
    }
  };

  // Delete account
  const handleDeleteAccount = async () => {
    if (deleteInput !== "DELETE") return;
    setDeleting(true);
    try {
      const res = await fetch("/api/settings/delete-account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (res.ok) {
        await signOut({ callbackUrl: "/auth/signin" });
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to delete account.");
      }
    } catch {
      showToast("Network error during deletion.");
    } finally {
      setDeleting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/50 mb-4">Sign in to access settings.</p>
          <Link href="/auth/signin" className="bg-primary text-black px-6 py-3 rounded-full font-bold">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-[#e5e2e1] pb-20">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-50 bg-[#131313]/60 backdrop-blur-[40px] border-b border-white/10 flex items-center px-4 md:px-8 py-4 gap-4 shadow-[0_8px_32px_0_rgba(255,180,170,0.05)]">
        <button
          onClick={handleBack}
          aria-label="Go back"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors text-white/60 hover:text-white cursor-pointer border-none"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <h1 className="font-serif text-xl font-bold text-white tracking-tight">Settings</h1>
      </header>

      <main className="pt-[76px] px-4 md:px-8 max-w-2xl mx-auto space-y-8">
        {loading ? (
          <div className="pt-16 flex flex-col items-center gap-4 text-white/30">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            <p className="text-sm">Loading settings…</p>
          </div>
        ) : (
          <>
            {/* ── ACCOUNT SECTION ─────────────────────────── */}
            <section className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">manage_accounts</span>
                <h2 className="font-bold text-white text-base">Account</h2>
              </div>
              <div className="p-6 space-y-5">
                {/* Sign-in method pill */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-white/50">Sign-in method</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${isCredentialsUser ? "bg-blue-500/20 text-blue-300 border-blue-500/30" : "bg-[#4285F4]/20 text-[#4285F4] border-[#4285F4]/30"}`}>
                    {isCredentialsUser ? (
                      <><span className="material-symbols-outlined text-xs mr-1">lock</span>Username & Password</>
                    ) : (
                      <>🔵 Google</>
                    )}
                  </span>
                </div>

                {/* Display name */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayNameDraft}
                    onChange={(e) => setDisplayNameDraft(e.target.value)}
                    maxLength={50}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary/50 transition-all"
                  />
                </div>

                {/* Username — credentials only */}
                {isCredentialsUser && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-1.5">
                      Username
                    </label>
                    <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus-within:border-primary/50 transition-all">
                      <span className="text-white/30 text-sm mr-1">@</span>
                      <input
                        type="text"
                        value={usernameDraft}
                        onChange={(e) => { setUsernameDraft(e.target.value); setUsernameError(null); }}
                        maxLength={30}
                        className="flex-1 bg-transparent text-sm text-white placeholder-white/30 focus:outline-none"
                      />
                    </div>
                    {usernameError && (
                      <p className="text-xs text-red-400 mt-1">{usernameError}</p>
                    )}
                  </div>
                )}

                <button
                  onClick={handleSaveAccount}
                  disabled={savingAccount}
                  className="w-full py-2.5 bg-primary text-black font-bold rounded-full text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {savingAccount ? (
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="material-symbols-outlined text-sm">save</span>
                  )}
                  Save Account Changes
                </button>
              </div>
            </section>

            {/* ── CHANGE PASSWORD (credentials users only) ── */}
            {isCredentialsUser && (
              <section className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">key</span>
                  <h2 className="font-bold text-white text-base">Change Password</h2>
                </div>
                <div className="p-6 space-y-4">
                  {[
                    { label: "Current Password", value: currentPwd, setter: setCurrentPwd },
                    { label: "New Password", value: newPwd, setter: setNewPwd },
                    { label: "Confirm New Password", value: confirmPwd, setter: setConfirmPwd },
                  ].map(({ label, value, setter }) => (
                    <div key={label}>
                      <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-1.5">
                        {label}
                      </label>
                      <input
                        type="password"
                        value={value}
                        onChange={(e) => { setter(e.target.value); setPwdError(null); }}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-all"
                      />
                    </div>
                  ))}
                  {pwdError && <p className="text-xs text-red-400">{pwdError}</p>}
                  <button
                    onClick={handleChangePassword}
                    disabled={savingPwd}
                    className="w-full py-2.5 bg-white/10 border border-white/15 text-white font-semibold rounded-full text-sm hover:bg-white/15 active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {savingPwd ? (
                      <div className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
                    ) : null}
                    Update Password
                  </button>
                </div>
              </section>
            )}

            {/* ── PRIVACY ─────────────────────────────────── */}
            <section className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">lock</span>
                <h2 className="font-bold text-white text-base">Privacy</h2>
              </div>
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {isPrivate ? "Private Profile" : "Public Profile"}
                    </p>
                    <p className="text-xs text-white/40 mt-1 max-w-xs leading-relaxed">
                      {isPrivate
                        ? "Only your followers can see your watchlist, ratings, and reviews."
                        : "Anyone can view your watchlist, ratings, and reviews."}
                    </p>
                  </div>
                  <button
                    onClick={() => handlePrivacyToggle(!isPrivate)}
                    disabled={savingPrivacy}
                    className={`relative w-12 h-6 rounded-full border-2 transition-all cursor-pointer flex-shrink-0 ${
                      isPrivate
                        ? "bg-primary border-primary"
                        : "bg-white/10 border-white/20"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-200 ${
                        isPrivate ? "translate-x-6" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </section>

            {/* ── NOTIFICATIONS ───────────────────────────── */}
            <section className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">notifications</span>
                <h2 className="font-bold text-white text-base">Notifications</h2>
              </div>
              <div className="divide-y divide-white/5">
                {([
                  { key: "followers", label: "New followers", desc: "When someone starts following you" },
                  { key: "likes", label: "Likes on your reviews", desc: "When someone likes a review you wrote" },
                  { key: "replies", label: "Replies to your reviews", desc: "When someone replies to your review" },
                ] as const).map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between gap-4 px-6 py-4">
                    <div>
                      <p className="text-sm font-semibold text-white">{label}</p>
                      <p className="text-xs text-white/40">{desc}</p>
                    </div>
                    <button
                      onClick={() => handleNotifToggle(key, !notifPrefs[key])}
                      disabled={savingNotif}
                      className={`relative w-12 h-6 rounded-full border-2 transition-all cursor-pointer flex-shrink-0 ${
                        notifPrefs[key]
                          ? "bg-primary border-primary"
                          : "bg-white/10 border-white/20"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-200 ${
                          notifPrefs[key] ? "translate-x-6" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* ── DANGER ZONE ─────────────────────────────── */}
            <section className="bg-red-950/20 border border-red-500/20 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-red-500/20 flex items-center gap-2">
                <span className="material-symbols-outlined text-red-400 text-lg">warning</span>
                <h2 className="font-bold text-red-400 text-base">Danger Zone</h2>
              </div>
              <div className="p-6">
                {!showDeleteConfirm ? (
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">Delete Account</p>
                      <p className="text-xs text-white/40 mt-1">
                        Permanently removes your profile, ratings, reviews, watchlist, and all data. This cannot be undone.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex-shrink-0 px-4 py-2 bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-semibold rounded-full hover:bg-red-500/25 transition-colors cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                      <p className="text-sm text-red-300 font-semibold mb-1">⚠ This action is permanent and cannot be undone.</p>
                      <p className="text-xs text-red-400/70">
                        All your data — watched films, ratings, reviews, and followers — will be deleted forever.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-1.5">
                        Type <span className="text-red-400 font-mono">DELETE</span> to confirm
                      </label>
                      <input
                        type="text"
                        value={deleteInput}
                        onChange={(e) => setDeleteInput(e.target.value)}
                        placeholder="DELETE"
                        className="w-full bg-red-500/5 border border-red-500/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-red-500/60 transition-all font-mono tracking-wider"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => { setShowDeleteConfirm(false); setDeleteInput(""); }}
                        className="flex-1 py-2.5 rounded-full border border-white/15 text-white/60 text-sm font-semibold hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deleteInput !== "DELETE" || deleting}
                        className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-full text-sm hover:bg-red-500 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                      >
                        {deleting ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="material-symbols-outlined text-sm">delete_forever</span>
                        )}
                        Delete My Account
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
