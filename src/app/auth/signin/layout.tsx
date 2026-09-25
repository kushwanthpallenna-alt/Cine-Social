import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Sign In - CineSocial",
  description: "Sign in to CineSocial to track movies, rate and review films, build your watchlist, and connect with friends.",
  alternates: {
    canonical: "https://cine-social-two.vercel.app/auth/signin",
  },
};

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
