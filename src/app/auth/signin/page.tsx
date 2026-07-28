"use client";

import React, { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isCredLoading, setIsCredLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  // Form state
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      setMousePos({ x, y });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await signIn("google", { callbackUrl });
    } catch {
      setIsGoogleLoading(false);
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!username.trim() || !password) {
      setFormError("Please fill in all fields.");
      return;
    }

    if (mode === "signup") {
      if (password !== confirmPassword) {
        setFormError("Passwords do not match.");
        return;
      }
      setIsCredLoading(true);
      try {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, displayName }),
        });
        const data = await res.json();
        if (!res.ok) {
          setFormError(data.error || "Signup failed.");
          setIsCredLoading(false);
          return;
        }
        // Auto sign in after signup
        const result = await signIn("credentials", {
          username,
          password,
          callbackUrl,
          redirect: false,
        });
        if (result?.error) {
          setFormError("Account created! Please sign in.");
          setMode("signin");
          setIsCredLoading(false);
          return;
        }
        window.location.href = callbackUrl;
      } catch {
        setFormError("Something went wrong. Try again.");
        setIsCredLoading(false);
      }
    } else {
      setIsCredLoading(true);
      const result = await signIn("credentials", {
        username,
        password,
        callbackUrl,
        redirect: false,
      });
      if (result?.error) {
        setFormError("Invalid username or password.");
        setIsCredLoading(false);
        return;
      }
      window.location.href = callbackUrl;
    }
  };

  const isLoading = isGoogleLoading || isCredLoading;

  return (
    <div className="relative min-h-screen bg-[#050505] flex items-center justify-center p-6 overflow-hidden select-none font-body-md text-[#e5e2e1]">
      {/* Dynamic Cinematic Gradient Background */}
      <div
        className="absolute inset-0 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(255, 180, 170, 0.08) 0%, transparent 60%)`,
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff03_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none opacity-40" />

      {/* Floating Decorative Elements */}
      <div className="absolute top-1/4 left-1/10 w-96 h-96 bg-primary/5 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/10 w-96 h-96 bg-secondary/5 rounded-full filter blur-[120px] pointer-events-none" />

      {/* Login Container */}
      <div className="relative w-full max-w-[440px] z-10">
        {/* Logo/Branding */}
        <div className="text-center mb-10 animate-fade-in">
          <h1 className="font-serif text-[48px] md:text-[56px] text-primary tracking-tighter leading-none select-none drop-shadow-[0_0_30px_rgba(255,180,170,0.2)]">
            CINE SOCIAL
          </h1>
          <p className="text-on-surface-variant font-body-lg text-body-lg mt-3 opacity-60 max-w-xs mx-auto">
            The premium cinema club. Discover, discuss, and curate films with your inner circle.
          </p>
        </div>

        {/* Glassmorphic Sign-in Card */}
        <div className="glass-panel p-8 md:p-10 rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.4)] backdrop-blur-[30px]">
          <h2 className="text-headline-lg font-serif mb-1 text-on-surface text-center">
            {mode === "signin" ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="text-on-surface-variant text-body-md text-center mb-6 opacity-75">
            {mode === "signin"
              ? "Sign in to access your dashboard and friends feed."
              : "Join the cinema club and start tracking films."}
          </p>

          {/* Mode Toggle */}
          <div className="flex rounded-full bg-white/5 border border-white/10 p-1 mb-6">
            <button
              onClick={() => { setMode("signin"); setFormError(null); setFormSuccess(null); }}
              className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer ${
                mode === "signin" ? "bg-primary text-black shadow-sm" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode("signup"); setFormError(null); setFormSuccess(null); }}
              className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer ${
                mode === "signup" ? "bg-primary text-black shadow-sm" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Credentials Form */}
          <form onSubmit={handleCredentialsSubmit} className="space-y-3 mb-5">
            {mode === "signup" && (
              <div>
                <label className="block text-xs text-on-surface-variant mb-1 opacity-70 uppercase tracking-wider">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name (optional)"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-on-surface text-sm placeholder-white/20 focus:outline-none focus:border-primary/60 transition-colors"
                  disabled={isLoading}
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-on-surface-variant mb-1 opacity-70 uppercase tracking-wider">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your_username"
                autoComplete="username"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-on-surface text-sm placeholder-white/20 focus:outline-none focus:border-primary/60 transition-colors"
                disabled={isLoading}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-on-surface-variant mb-1 opacity-70 uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-on-surface text-sm placeholder-white/20 focus:outline-none focus:border-primary/60 transition-colors"
                disabled={isLoading}
                required
              />
            </div>
            {mode === "signup" && (
              <div>
                <label className="block text-xs text-on-surface-variant mb-1 opacity-70 uppercase tracking-wider">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-on-surface text-sm placeholder-white/20 focus:outline-none focus:border-primary/60 transition-colors"
                  disabled={isLoading}
                  required
                />
              </div>
            )}

            {/* Error / Success */}
            {formError && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <span className="material-symbols-outlined text-red-400 text-sm">error</span>
                <p className="text-red-400 text-sm">{formError}</p>
              </div>
            )}
            {formSuccess && (
              <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
                <span className="material-symbols-outlined text-green-400 text-sm">check_circle</span>
                <p className="text-green-400 text-sm">{formSuccess}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-primary text-black font-bold text-body-lg py-4 px-6 rounded-full shadow-[0_4px_20px_rgba(255,180,170,0.3)] hover:shadow-[0_4px_30px_rgba(255,180,170,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isCredLoading ? (
                <svg className="animate-spin h-5 w-5 text-black" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <span className="material-symbols-outlined text-black text-[20px]">
                  {mode === "signin" ? "login" : "person_add"}
                </span>
              )}
              <span>{mode === "signin" ? "Sign In" : "Create Account"}</span>
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-on-surface-variant opacity-40 uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Google Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 bg-white text-black font-semibold text-body-lg py-4 px-6 rounded-full shadow-[0_4px_20px_rgba(255,255,255,0.15)] hover:shadow-[0_4px_30px_rgba(255,255,255,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed group relative overflow-hidden"
          >
            {isGoogleLoading ? (
              <svg className="animate-spin h-5 w-5 text-black" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 flex-shrink-0 transition-transform duration-300 group-hover:rotate-12" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            <span>Continue with Google</span>
          </button>

          {/* Footer detail */}
          <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-on-surface-variant tracking-widest uppercase opacity-40">
            <span className="material-symbols-outlined text-xs">local_movies</span>
            <span>Est. 2026</span>
            <span className="h-1 w-1 bg-on-surface-variant rounded-full" />
            <span>Secure Auth</span>
          </div>
        </div>

        <p className="text-center mt-6 text-label-sm text-on-surface-variant opacity-40 max-w-xs mx-auto">
          By signing in, you agree to join our private cinema dashboard and interact with Cineverse modules.
        </p>
      </div>
    </div>
  );
}

const SignInSkeleton = () => (
  <div className="relative min-h-screen bg-[#050505] flex items-center justify-center p-6 overflow-hidden select-none font-body-md text-[#e5e2e1]">
    <div className="relative w-full max-w-[440px] z-10">
      <div className="text-center mb-10">
        <div className="h-12 bg-white/5 animate-pulse rounded w-2/3 mx-auto mb-3"></div>
        <div className="h-6 bg-white/5 animate-pulse rounded w-5/6 mx-auto"></div>
      </div>
      <div className="glass-panel p-8 md:p-10 rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.4)] backdrop-blur-[30px] h-[460px] flex flex-col justify-between">
        <div className="space-y-4">
          <div className="h-8 bg-white/10 animate-pulse rounded w-1/2 mx-auto"></div>
          <div className="h-4 bg-white/10 animate-pulse rounded w-3/4 mx-auto"></div>
        </div>
        <div className="space-y-3">
          <div className="h-12 bg-white/10 animate-pulse rounded-xl w-full"></div>
          <div className="h-12 bg-white/10 animate-pulse rounded-xl w-full"></div>
          <div className="h-14 bg-white/10 animate-pulse rounded-full w-full"></div>
        </div>
        <div className="h-3 bg-white/5 animate-pulse rounded w-1/3 mx-auto"></div>
      </div>
    </div>
  </div>
);

export default function SignIn() {
  return (
    <Suspense fallback={<SignInSkeleton />}>
      <SignInContent />
    </Suspense>
  );
}
