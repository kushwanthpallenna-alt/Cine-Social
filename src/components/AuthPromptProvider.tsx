"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { useSession } from "next-auth/react";

interface AuthPromptOptions {
  title?: string;
  message?: string;
  callbackUrl?: string;
}

interface AuthPromptContextType {
  requireAuth: (action: () => void | Promise<void>, options?: AuthPromptOptions) => void;
  showAuthPrompt: (options?: AuthPromptOptions) => void;
  closeAuthPrompt: () => void;
}

const AuthPromptContext = createContext<AuthPromptContextType | undefined>(undefined);

export function useAuthPrompt() {
  const context = useContext(AuthPromptContext);
  if (!context) {
    throw new Error("useAuthPrompt must be used within an AuthPromptProvider");
  }
  return context;
}

export default function AuthPromptProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [promptOptions, setPromptOptions] = useState<AuthPromptOptions>({
    title: "Sign in to continue",
    message: "Create an account or sign in to track films, build your watchlist, and join the discussion.",
  });

  const showAuthPrompt = useCallback((options?: AuthPromptOptions) => {
    setPromptOptions({
      title: options?.title || "Sign in to continue",
      message: options?.message || "Create an account or sign in to track films, build your watchlist, and join the discussion.",
      callbackUrl: options?.callbackUrl,
    });
    setIsOpen(true);
  }, []);

  const closeAuthPrompt = useCallback(() => {
    setIsOpen(false);
  }, []);

  const requireAuth = useCallback(
    (action: () => void | Promise<void>, options?: AuthPromptOptions) => {
      if (session?.user) {
        action();
      } else {
        showAuthPrompt(options);
      }
    },
    [session, showAuthPrompt]
  );

  const handleSignIn = () => {
    if (typeof window === "undefined") return;
    const callback = promptOptions.callbackUrl || `${window.location.pathname}${window.location.search}`;
    window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(callback)}`;
  };

  return (
    <AuthPromptContext.Provider value={{ requireAuth, showAuthPrompt, closeAuthPrompt }}>
      {children}
      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={closeAuthPrompt}
        >
          <div
            className="relative w-full max-w-sm bg-[#121214] border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={closeAuthPrompt}
              className="absolute top-4 right-4 text-white/40 hover:text-white p-1 rounded-full transition-colors cursor-pointer border-none bg-transparent"
              aria-label="Close"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            {/* Icon / Brand illustration */}
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 text-primary shadow-[0_0_20px_rgba(229,9,20,0.15)]">
              <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                local_activity
              </span>
            </div>

            {/* Content */}
            <h3 className="text-xl font-bold font-serif text-white tracking-wide mb-2">
              {promptOptions.title}
            </h3>
            <p className="text-sm text-white/60 leading-relaxed mb-6">
              {promptOptions.message}
            </p>

            {/* Actions */}
            <div className="w-full flex flex-col gap-2.5">
              <button
                onClick={handleSignIn}
                className="w-full py-3 px-4 bg-primary text-black font-bold rounded-xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 cursor-pointer border-none"
              >
                <span className="material-symbols-outlined text-lg">login</span>
                Sign In / Sign Up
              </button>
              <button
                onClick={closeAuthPrompt}
                className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl font-medium transition-all text-sm cursor-pointer border border-white/5"
              >
                Continue Browsing
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthPromptContext.Provider>
  );
}
