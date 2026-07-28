"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";

type ToastContextType = {
  showToast: (message: string) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; visible: boolean; id: number }>({
    message: "",
    visible: false,
    id: 0,
  });

  const showToast = useCallback((message: string) => {
    const newId = Date.now();
    setToast({ message, visible: true, id: newId });

    setTimeout(() => {
      setToast((prev) => {
        if (prev.id === newId) {
          return { ...prev, visible: false };
        }
        return prev;
      });
    }, 2000); // Auto dismiss after 2 seconds
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast.visible && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[9999] bg-[#131313] text-[#e5e2e1] px-6 py-3 rounded-full border border-white/10 shadow-[0_8px_32px_rgba(255,180,170,0.15)] flex items-center gap-2 animate-fade-in pointer-events-none">
          <span className="material-symbols-outlined text-primary">check_circle</span>
          <span className="font-semibold">{toast.message}</span>
        </div>
      )}
    </ToastContext.Provider>
  );
}
