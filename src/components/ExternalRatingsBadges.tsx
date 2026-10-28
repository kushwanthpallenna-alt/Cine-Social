"use client";

import React, { useEffect, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExternalRatings {
  imdb_id: string | null;
  imdb_rating: number | null;
  imdb_votes: string | null;
  rt_score: number | null;
  metascore: number | null;
}

interface CineSocialRating {
  average: number;
  count: number;
}

interface ExternalRatingsBadgesProps {
  /** TMDB numeric id (string) */
  tmdbId: string;
  /** "movie" | "tv" */
  mediaType: "movie" | "tv";
  /** CineSocial average rating data, already computed from Supabase ratings */
  cineSocialRating?: CineSocialRating | null;
  /** Whether this is a movie (shows Letterboxd link) */
  isMovie?: boolean;
}

// ─── Badge sub-components ─────────────────────────────────────────────────────

function ImdbBadge({
  rating,
  votes,
  imdbId,
}: {
  rating: number;
  votes: string | null;
  imdbId: string | null;
}) {
  const content = (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
                 bg-[#f5c518]/15 border border-[#f5c518]/40 text-[#f5c518]
                 transition-all hover:bg-[#f5c518]/25"
      title={votes ? `IMDb — ${votes} votes` : "IMDb rating"}
    >
      <span className="font-extrabold tracking-tight">IMDb</span>
      <span style={{ fontSize: "12px", lineHeight: 1 }}>★</span>
      <span>{rating.toFixed(1)}</span>
    </span>
  );

  if (imdbId) {
    return (
      <a
        href={`https://www.imdb.com/title/${imdbId}/`}
        target="_blank"
        rel="noopener noreferrer"
        className="no-underline active:scale-95 transition-transform"
        aria-label={`IMDb rating: ${rating.toFixed(1)}`}
      >
        {content}
      </a>
    );
  }
  return content;
}

function RtBadge({ score }: { score: number }) {
  const isFresh = score >= 60;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all
        ${
          isFresh
            ? "bg-[#fa320a]/15 border-[#fa320a]/40 text-[#fa320a] hover:bg-[#fa320a]/25"
            : "bg-[#2e8b57]/15 border-[#2e8b57]/40 text-[#2e8b57] hover:bg-[#2e8b57]/25"
        }`}
      title={`Rotten Tomatoes — ${isFresh ? "Fresh" : "Rotten"}`}
    >
      <span style={{ fontSize: "13px", lineHeight: 1 }}>{isFresh ? "🍅" : "🟢"}</span>
      <span>Rotten Tomatoes {score}%</span>
    </span>
  );
}

function MetaBadge({ score }: { score: number }) {
  const color =
    score >= 61
      ? "bg-[#54a72a]/20 border-[#54a72a]/50 text-[#60c631]"
      : score >= 40
      ? "bg-[#ffbd3f]/20 border-[#ffbd3f]/50 text-[#ffbd3f]"
      : "bg-[#ff2000]/20 border-[#ff2000]/50 text-[#ff4d4d]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all hover:brightness-110 ${color}`}
      title="Metacritic score"
    >
      <span className="font-bold">Metacritic</span>
      <span>{score}</span>
    </span>
  );
}

function LetterboxdLink({ tmdbId }: { tmdbId: string }) {
  return (
    <a
      href={`https://letterboxd.com/tmdb/${tmdbId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
                 bg-[#00e054]/10 border border-[#00e054]/30 text-[#00e054]
                 transition-all hover:bg-[#00e054]/20 no-underline active:scale-95"
      aria-label="View on Letterboxd"
      title="View on Letterboxd"
    >
      <span
        style={{
          fontSize: "10px",
          fontFamily: "monospace",
          fontWeight: 900,
          letterSpacing: "-0.5px",
        }}
      >
        LB
      </span>
      <span>Letterboxd</span>
      <span className="material-symbols-outlined text-[13px] opacity-70">open_in_new</span>
    </a>
  );
}

function CineSocialBadge({ average, count }: CineSocialRating) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
                 bg-primary/15 border border-primary/40 text-primary
                 transition-all hover:bg-primary/25"
      title={`CineSocial community average — ${count} rating${count === 1 ? "" : "s"}`}
    >
      <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
        movie
      </span>
      <span>CineSocial {average.toFixed(1)}</span>
      <span className="opacity-70 font-normal text-[11px]">({count})</span>
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ExternalRatingsBadges({
  tmdbId,
  mediaType,
  cineSocialRating,
  isMovie = true,
}: ExternalRatingsBadgesProps) {
  const [ratings, setRatings] = useState<ExternalRatings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tmdbId) return;

    let cancelled = false;
    setLoading(true);

    fetch(`/api/ratings?tmdb_id=${encodeURIComponent(tmdbId)}&type=${mediaType}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) {
          setRatings(data ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tmdbId, mediaType]);

  const hasAnyBadge =
    ratings?.imdb_rating ||
    ratings?.rt_score !== null ||
    ratings?.metascore !== null ||
    (isMovie) ||
    cineSocialRating;

  if (loading) {
    // Minimal skeleton – single translucent pill row
    return (
      <div className="flex flex-wrap items-center gap-2 mt-4 mb-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-6 w-16 rounded-full bg-white/8 animate-skeleton-pulse"
          />
        ))}
      </div>
    );
  }

  // Nothing at all – just omit the whole block (don't even show an empty row)
  const showAnyOmdb =
    ratings?.imdb_rating !== null ||
    ratings?.rt_score !== null ||
    ratings?.metascore !== null;
  const showBlock = showAnyOmdb || isMovie || cineSocialRating;

  if (!showBlock) return null;

  return (
    <div className="mt-4 mb-1 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {ratings?.imdb_rating !== null && ratings?.imdb_rating !== undefined && (
          <ImdbBadge
            rating={ratings.imdb_rating}
            votes={ratings.imdb_votes ?? null}
            imdbId={ratings.imdb_id ?? null}
          />
        )}
        {ratings?.rt_score !== null && ratings?.rt_score !== undefined && (
          <RtBadge score={ratings.rt_score} />
        )}
        {ratings?.metascore !== null && ratings?.metascore !== undefined && (
          <MetaBadge score={ratings.metascore} />
        )}
        {isMovie && <LetterboxdLink tmdbId={tmdbId} />}
        {cineSocialRating && cineSocialRating.count > 0 && (
          <CineSocialBadge
            average={cineSocialRating.average}
            count={cineSocialRating.count}
          />
        )}
      </div>
      {showAnyOmdb && (
        <p className="text-[10px] text-on-surface-variant/40 tracking-wide">
          Ratings data via OMDb
        </p>
      )}
    </div>
  );
}
