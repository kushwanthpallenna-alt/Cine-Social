"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { supabase } from "@/lib/supabase";

const GENRE_MAP: { [key: number]: string } = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi",
  10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western"
};

export default function YearlyWrappedPage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const currentYear = new Date().getFullYear();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (!user?.id) return;

    async function generateWrapped() {
      try {
        const { data: watchedData, error } = await supabase
          .from("watched")
          .select("*")
          .eq("user_id", user.id)
          .gte("watched_at", `${currentYear}-01-01T00:00:00Z`)
          .lte("watched_at", `${currentYear}-12-31T23:59:59Z`);

        if (error || !watchedData || watchedData.length === 0) {
          setLoading(false);
          return;
        }

        let totalWatchTime = 0;
        const genreCounts: Record<number, number> = {};
        const actorCounts: Record<string, { count: number; name: string; profile_path: string }> = {};
        const directorCounts: Record<string, { count: number; name: string; profile_path: string }> = {};
        const dateCounts: Record<string, number> = {};

        await Promise.all(
          watchedData.map(async (w) => {
            // Count for marathon
            const dateStr = new Date(w.watched_at).toISOString().split('T')[0];
            dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;

            try {
              const res = await fetch(`/api/tmdb?endpoint=movie/${w.movie_id}&append_to_response=credits`);
              if (res.ok) {
                const details = await res.json();
                totalWatchTime += details.runtime || 0;

                details.genres?.forEach((g: any) => {
                  genreCounts[g.id] = (genreCounts[g.id] || 0) + 1;
                });

                details.credits?.cast?.forEach((c: any) => {
                  if (!actorCounts[c.id]) actorCounts[c.id] = { count: 0, name: c.name, profile_path: c.profile_path };
                  actorCounts[c.id].count++;
                });

                details.credits?.crew?.forEach((c: any) => {
                  if (c.job === "Director") {
                    if (!directorCounts[c.id]) directorCounts[c.id] = { count: 0, name: c.name, profile_path: c.profile_path };
                    directorCounts[c.id].count++;
                  }
                });
              }
            } catch (e) {
              console.error(e);
            }
          })
        );

        const topGenres = Object.entries(genreCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([id]) => GENRE_MAP[parseInt(id)]);

        const topActor = Object.values(actorCounts).sort((a, b) => b.count - a.count)[0];
        const topDirector = Object.values(directorCounts).sort((a, b) => b.count - a.count)[0];
        const longestMarathon = Math.max(...Object.values(dateCounts), 0);

        setStats({
          totalMovies: watchedData.length,
          totalWatchTime,
          topGenres,
          topActor,
          topDirector,
          longestMarathon
        });
      } catch (err) {
        console.error("Error generating wrapped:", err);
      } finally {
        setLoading(false);
      }
    }

    generateWrapped();
  }, [user?.id, currentYear]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center flex-col">
        <div className="h-16 w-16 border-4 border-[#e9c349] border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(233,195,73,0.5)]"></div>
        <p className="text-[#e9c349] font-serif mt-6 text-lg tracking-widest animate-pulse">Generating your Cinematic Year...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center flex-col">
        <h1 className="text-3xl text-[#e5e2e1] font-serif mb-4">Not enough data for {currentYear}.</h1>
        <Link href="/profile" className="text-primary hover:underline">Back to Profile</Link>
      </div>
    );
  }

  const slides = [
    (
      <div key="1" className="h-full flex flex-col items-center justify-center text-center p-8 bg-gradient-to-b from-[#1a150c] to-[#050505]">
        <h1 className="text-6xl font-serif text-[#e9c349] mb-4 text-shadow-glow">CINE WRAPPED</h1>
        <h2 className="text-3xl text-white font-bold">{currentYear}</h2>
        <p className="mt-8 text-xl text-on-surface-variant">Your cinematic journey, quantified.</p>
      </div>
    ),
    (
      <div key="2" className="h-full flex flex-col items-center justify-center text-center p-8 bg-gradient-to-tr from-[#2d0a0b] to-[#050505]">
        <p className="text-xl text-on-surface-variant uppercase tracking-widest mb-4">You watched</p>
        <h1 className="text-8xl font-serif text-[#e50914] text-shadow-glow">{stats.totalMovies}</h1>
        <p className="text-2xl text-white font-bold mt-4">Movies this year.</p>
        <p className="mt-8 text-lg text-on-surface-variant">That's <span className="text-[#e9c349] font-bold">{Math.round(stats.totalWatchTime / 60)} hours</span> of screen time.</p>
      </div>
    ),
    (
      <div key="3" className="h-full flex flex-col items-center justify-center text-center p-8 bg-gradient-to-tl from-[#0a1f18] to-[#050505]">
        <p className="text-xl text-on-surface-variant uppercase tracking-widest mb-8">Your Cinematic DNA</p>
        <div className="space-y-6">
          {stats.topGenres.map((g: string, i: number) => (
            <div key={i} className="flex items-center gap-4">
              <span className="text-[#e9c349] font-serif text-3xl font-bold">#{i + 1}</span>
              <span className="text-4xl text-white font-bold">{g}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    (
      <div key="4" className="h-full flex flex-col items-center justify-center text-center p-8 bg-gradient-to-b from-[#1f1a0a] to-[#050505]">
        <p className="text-xl text-on-surface-variant uppercase tracking-widest mb-4">Your Muses</p>
        {stats.topDirector && (
          <div className="mb-8 flex flex-col items-center">
            {stats.topDirector.profile_path ? (
              <img src={`https://image.tmdb.org/t/p/w185${stats.topDirector.profile_path}`} className="w-32 h-32 rounded-full border-4 border-[#e9c349] object-cover mb-4 shadow-[0_0_20px_rgba(233,195,73,0.3)]" />
            ) : (
              <div className="w-32 h-32 rounded-full border-4 border-[#e9c349] flex items-center justify-center mb-4 bg-white/5"><span className="material-symbols-outlined text-4xl text-[#e9c349]">movie_filter</span></div>
            )}
            <p className="text-sm text-on-surface-variant uppercase">Most Watched Director</p>
            <p className="text-2xl text-white font-bold">{stats.topDirector.name} ({stats.topDirector.count} films)</p>
          </div>
        )}
        {stats.topActor && (
          <div className="flex flex-col items-center">
            {stats.topActor.profile_path ? (
              <img src={`https://image.tmdb.org/t/p/w185${stats.topActor.profile_path}`} className="w-24 h-24 rounded-full border-2 border-white/20 object-cover mb-2" />
            ) : (
              <div className="w-24 h-24 rounded-full border-2 border-white/20 flex items-center justify-center mb-2 bg-white/5"><span className="material-symbols-outlined text-3xl text-white/50">person</span></div>
            )}
            <p className="text-sm text-on-surface-variant uppercase">Most Watched Actor</p>
            <p className="text-xl text-white font-bold">{stats.topActor.name} ({stats.topActor.count} films)</p>
          </div>
        )}
      </div>
    ),
    (
      <div key="5" className="h-full flex flex-col items-center justify-center text-center p-8 bg-gradient-to-tr from-[#1a0c1f] to-[#050505]">
        <p className="text-xl text-on-surface-variant uppercase tracking-widest mb-4">Longest Marathon</p>
        <h1 className="text-8xl font-serif text-[#e9c349] text-shadow-glow">{stats.longestMarathon}</h1>
        <p className="text-2xl text-white font-bold mt-4">Movies in a single day.</p>
        <Link href="/profile" className="mt-12 px-8 py-3 rounded-full bg-[#e9c349] text-black font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(233,195,73,0.4)] hover:scale-105 transition-transform">
          Back to Profile
        </Link>
      </div>
    )
  ];

  return (
    <div className="fixed inset-0 bg-[#050505] z-[9999] text-[#e5e2e1] overflow-hidden">
      {/* Progress Bars */}
      <div className="absolute top-4 left-4 right-4 flex gap-2 z-10">
        {slides.map((_, i) => (
          <div key={i} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
            <div className={`h-full bg-white transition-all duration-300 ${i <= slide ? 'w-full' : 'w-0'}`}></div>
          </div>
        ))}
      </div>

      {/* Navigation Areas */}
      <div className="absolute inset-0 z-0 flex">
        <div className="flex-1 cursor-pointer" onClick={() => setSlide(Math.max(0, slide - 1))}></div>
        <div className="flex-1 cursor-pointer" onClick={() => setSlide(Math.min(slides.length - 1, slide + 1))}></div>
      </div>

      <div className="absolute inset-0 pointer-events-none transition-opacity duration-500 flex items-center justify-center">
        {slides[slide]}
      </div>
    </div>
  );
}
