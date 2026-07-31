"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          registration.update();
        })
        .catch((err) => {
          console.error("ServiceWorker registration failed: ", err);
        });
    }
  }, []);

  return null;
}
