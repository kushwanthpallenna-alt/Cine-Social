"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PersonDetailClient from "@/components/PersonDetailClient";

function PersonQueryContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";
  return <PersonDetailClient personId={id} />;
}

export default function PersonQueryPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-[#050505] text-[#e5e2e1] min-h-screen flex items-center justify-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <PersonQueryContent />
    </Suspense>
  );
}
