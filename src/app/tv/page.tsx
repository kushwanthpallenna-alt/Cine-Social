"use client";

import React, { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getTvUrl } from "@/lib/slug";

function TvPageRouter() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tvId = searchParams.get("id");

  useEffect(() => {
    if (tvId) {
      router.replace(getTvUrl(tvId));
    } else {
      router.replace("/movies");
    }
  }, [tvId, router]);

  return (
    <div className="bg-[#050505] min-h-screen text-white flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

export default function TvPage() {
  return (
    <Suspense fallback={<div className="bg-[#050505] min-h-screen" />}>
      <TvPageRouter />
    </Suspense>
  );
}
