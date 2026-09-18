"use client";

import Link from "next/link";
import Image from "next/image";
import React from "react";
import { useSession } from "next-auth/react";
import { getSafeAvatarUrl } from "@/lib/avatar";
import NotificationBell from "@/components/NotificationBell";

export default function TopAppBar() {
  const { data: session } = useSession();
  const user = session?.user;
  const safeAvatar = getSafeAvatarUrl(user?.image);
  const initials = (user?.name || user?.email || "U").slice(0, 2).toUpperCase();

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-surface/60 backdrop-blur-[40px] border-b border-white/10 shadow-[0_8px_32px_0_rgba(255,180,170,0.05)] flex justify-between items-center px-container-margin py-stack-md transition-all duration-300">
      <div className="flex items-center gap-stack-md">
        <Link href="/profile" className="w-8 h-8 rounded-full overflow-hidden border border-primary/20 hover:opacity-80 active:scale-95 transition-all duration-200 flex items-center justify-center bg-white/5 relative">
          {safeAvatar ? (
            <Image
              alt="User profile photo"
              className="object-cover"
              src={safeAvatar}
              width={32}
              height={32}
              loading="lazy"
              sizes="32px"
            />
          ) : (
            <span className="text-primary font-bold text-xs font-serif">{initials}</span>
          )}
        </Link>
        <Link href="/" className="hover:opacity-90 active:scale-98 transition-all block">
          <h1 className="font-serif text-display-md text-primary tracking-tighter hidden md:block select-none">
            CINE SOCIAL
          </h1>
          <h1 className="font-serif text-headline-lg-mobile tracking-tight md:hidden text-primary select-none">
            CINE SOCIAL
          </h1>
        </Link>
      </div>
      <div className="flex items-center gap-stack-md">
        <NotificationBell />
      </div>
    </header>
  );
}
