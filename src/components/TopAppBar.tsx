"use client";

import Link from "next/link";
import React from "react";

export default function TopAppBar() {
  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-surface/60 backdrop-blur-[40px] border-b border-white/10 shadow-[0_8px_32px_0_rgba(255,180,170,0.05)] flex justify-between items-center px-container-margin py-stack-md transition-all duration-300">
      <div className="flex items-center gap-stack-md">
        <Link href="/profile" className="w-8 h-8 rounded-full overflow-hidden border border-primary/20 hover:opacity-80 active:scale-95 transition-all duration-200 block">
          <img
            alt="User profile photo"
            className="w-full h-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCcpNEmqaSRuUfODx5M1cjdnq9EEEbiCrsmZ2vCvZsTJZIbRHLx-QKN7NPxQnMn52i23E0ad8IxNRCq4YKByiecYs3q0TdXsrfwimZtUZCfW3I-a4-GIzNikhPpuvOgq7VwDk5ORaIs8NHCZ361NQzEJcmQHuHGWSKWE2ENjpnqnTfFZlE_xNAQaUbRo1dzij0LYO9cSrgshW1UgGFdMODJR5_cb029SIayAMy-Y6VPh8YJOaqKOfB1agGnlbPjlYlSHMjzxvinx48"
          />
        </Link>
        <Link href="/home" className="hover:opacity-90 active:scale-98 transition-all block">
          <h1 className="font-serif text-display-md text-primary tracking-tighter hidden md:block select-none">
            CINE SOCIAL
          </h1>
          <h1 className="font-serif text-headline-lg-mobile tracking-tight md:hidden text-primary select-none">
            CINE SOCIAL
          </h1>
        </Link>
      </div>
      <div className="flex items-center gap-stack-md">
        <button className="material-symbols-outlined text-on-surface-variant hover:opacity-80 transition-opacity active:scale-95 duration-200 cursor-pointer">
          notifications
        </button>
      </div>
    </header>
  );
}
