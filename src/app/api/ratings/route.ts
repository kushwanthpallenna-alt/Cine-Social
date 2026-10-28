import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// TTL: 30 days for old titles, 7 days for titles released in the last 90 days
const TTL_DAYS_RECENT = 7;
const TTL_DAYS_DEFAULT = 30;
const RECENT_RELEASE_DAYS = 90;

function msToDay(ms: number) {
  return ms / 1000 / 60 / 60 / 24;
}

function isCacheStale(fetchedAt: string, releaseDate?: string | null): boolean {
  const fetchedMs = Date.parse(fetchedAt);
  const ageInDays = msToDay(Date.now() - fetchedMs);

  if (releaseDate) {
    const releaseMs = Date.parse(releaseDate);
    const releasedDaysAgo = msToDay(Date.now() - releaseMs);
    if (releasedDaysAgo <= RECENT_RELEASE_DAYS) {
      return ageInDays > TTL_DAYS_RECENT;
    }
  }

  return ageInDays > TTL_DAYS_DEFAULT;
}

/** Parse OMDb Ratings array + top-level fields into our schema columns. */
function parseOmdbData(omdb: any): {
  imdb_id: string | null;
  imdb_rating: number | null;
  imdb_votes: string | null;
  rt_score: number | null;
  metascore: number | null;
} {
  const nullify = (v: string | undefined | null) =>
    !v || v === "N/A" ? null : v;

  const imdbRaw = nullify(omdb?.imdbRating);
  const metaRaw = nullify(omdb?.Metascore);

  let rt_score: number | null = null;
  if (Array.isArray(omdb?.Ratings)) {
    const rtEntry = omdb.Ratings.find(
      (r: any) => r.Source === "Rotten Tomatoes"
    );
    if (rtEntry) {
      const pct = parseInt(rtEntry.Value, 10);
      if (!isNaN(pct)) rt_score = pct;
    }
  }

  return {
    imdb_id: nullify(omdb?.imdbID),
    imdb_rating: imdbRaw ? parseFloat(imdbRaw) : null,
    imdb_votes: nullify(omdb?.imdbVotes),
    rt_score,
    metascore: metaRaw ? parseInt(metaRaw, 10) : null,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tmdbId = searchParams.get("tmdb_id");
  const mediaType = searchParams.get("type") as "movie" | "tv" | null;

  if (!tmdbId || !mediaType || !["movie", "tv"].includes(mediaType)) {
    return Response.json(
      { error: "tmdb_id and type (movie|tv) are required" },
      { status: 400 }
    );
  }

  // ── 1. Check cache ────────────────────────────────────────────────────────
  const { data: cached, error: cacheErr } = await supabaseAdmin
    .from("external_ratings")
    .select("*")
    .eq("tmdb_id", tmdbId)
    .eq("media_type", mediaType)
    .maybeSingle();

  if (cached && !cacheErr) {
    const fetchedMs = Date.parse(cached.fetched_at);
    const ageInDays = msToDay(Date.now() - fetchedMs);

    if (ageInDays <= TTL_DAYS_RECENT) {
      // Under 7 days: guaranteed fresh regardless of release date
      return Response.json({
        tmdb_id: tmdbId,
        media_type: mediaType,
        imdb_id: cached.imdb_id,
        imdb_rating: cached.imdb_rating,
        imdb_votes: cached.imdb_votes,
        rt_score: cached.rt_score,
        metascore: cached.metascore,
        source: "cache",
      });
    }

    if (ageInDays <= TTL_DAYS_DEFAULT) {
      // Between 7 and 30 days: only stale if released in the last 90 days
      let releaseDate: string | null = null;
      try {
        const tmdbKey = process.env.TMDB_API_KEY;
        if (tmdbKey) {
          const endpoint =
            mediaType === "movie"
              ? `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${tmdbKey}`
              : `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${tmdbKey}`;
          const tmdbRes = await fetch(endpoint, { next: { revalidate: 3600 } });
          if (tmdbRes.ok) {
            const tmdbData = await tmdbRes.json();
            releaseDate = tmdbData.release_date ?? tmdbData.first_air_date ?? null;
          }
        }
      } catch {
        // Non-fatal
      }

      if (!isCacheStale(cached.fetched_at, releaseDate)) {
        return Response.json({
          tmdb_id: tmdbId,
          media_type: mediaType,
          imdb_id: cached.imdb_id,
          imdb_rating: cached.imdb_rating,
          imdb_votes: cached.imdb_votes,
          rt_score: cached.rt_score,
          metascore: cached.metascore,
          source: "cache",
        });
      }
    }
  }

  // ── 2. Resolve IMDb id from TMDB ──────────────────────────────────────────
  const omdbKey = process.env.OMDB_API_KEY;
  if (!omdbKey) {
    console.warn("[ratings] OMDB_API_KEY is missing – skipping OMDb fetch");
    if (cached) {
      return Response.json({ ...cached, source: "stale_cache" });
    }
    return Response.json({
      tmdb_id: tmdbId,
      media_type: mediaType,
      imdb_id: null,
      imdb_rating: null,
      imdb_votes: null,
      rt_score: null,
      metascore: null,
      source: "no_key",
    });
  }

  let imdbId: string | null = null;
  try {
    const tmdbKey = process.env.TMDB_API_KEY;
    if (!tmdbKey) throw new Error("TMDB_API_KEY missing");

    if (mediaType === "movie") {
      const res = await fetch(
        `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${tmdbKey}`,
        { next: { revalidate: 3600 } }
      );
      if (res.ok) {
        const d = await res.json();
        imdbId = d.imdb_id ?? null;
      }
    } else {
      const url = `https://api.themoviedb.org/3/tv/${tmdbId}/external_ids?api_key=${tmdbKey}`;
      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (res.ok) {
        const d = await res.json();
        imdbId = d.imdb_id ?? null;
      }
    }
  } catch (err: any) {
    console.error("[ratings] Failed to resolve IMDb id from TMDB:", err);
  }

  if (!imdbId) {
    // No IMDb id – return stale or nulls
    if (cached) return Response.json({ ...cached, source: "stale_cache" });
    return Response.json({
      tmdb_id: tmdbId,
      media_type: mediaType,
      imdb_id: null,
      imdb_rating: null,
      imdb_votes: null,
      rt_score: null,
      metascore: null,
      source: "no_imdb_id",
    });
  }

  // ── 3. Call OMDb ──────────────────────────────────────────────────────────
  let parsed: {
    imdb_id: string | null;
    imdb_rating: number | null;
    imdb_votes: string | null;
    rt_score: number | null;
    metascore: number | null;
  } = {
    imdb_id: imdbId,
    imdb_rating: null,
    imdb_votes: null,
    rt_score: null,
    metascore: null,
  };

  try {
    const omdbRes = await fetch(
      `https://www.omdbapi.com/?i=${imdbId}&apikey=${omdbKey}`,
      { next: { revalidate: 3600 } }
    );

    if (!omdbRes.ok) {
      throw new Error(`OMDb HTTP ${omdbRes.status}`);
    }

    const omdbData = await omdbRes.json();

    if (omdbData?.Response === "False") {
      const reason: string = omdbData?.Error ?? "unknown";
      if (reason.toLowerCase().includes("limit")) {
        console.warn("[ratings] OMDb request limit reached");
      } else {
        console.warn("[ratings] OMDb returned False for", imdbId, "–", reason);
      }
      // Return stale cache if available, or nulls
      if (cached) return Response.json({ ...cached, source: "stale_cache" });
      return Response.json({
        tmdb_id: tmdbId,
        media_type: mediaType,
        imdb_id: imdbId,
        imdb_rating: null,
        imdb_votes: null,
        rt_score: null,
        metascore: null,
        source: "omdb_error",
      });
    } else {
      parsed = parseOmdbData(omdbData);
    }
  } catch (err) {
    console.error("[ratings] OMDb fetch failed:", err);
    if (cached) return Response.json({ ...cached, source: "stale_cache" });
    return Response.json({
      tmdb_id: tmdbId,
      media_type: mediaType,
      imdb_id: imdbId,
      imdb_rating: null,
      imdb_votes: null,
      rt_score: null,
      metascore: null,
      source: "fetch_failed",
    });
  }

  // ── 4. Upsert into cache ──────────────────────────────────────────────────
  const row = {
    tmdb_id: tmdbId,
    media_type: mediaType,
    imdb_id: parsed.imdb_id,
    imdb_rating: parsed.imdb_rating,
    imdb_votes: parsed.imdb_votes,
    rt_score: parsed.rt_score,
    metascore: parsed.metascore,
    fetched_at: new Date().toISOString(),
  };

  const { error: upsertErr } = await supabaseAdmin
    .from("external_ratings")
    .upsert(row, { onConflict: "tmdb_id,media_type" });

  if (upsertErr) {
    console.error("[ratings] Failed to upsert external_ratings:", upsertErr);
  }

  return Response.json({ ...row, source: "omdb_fresh" });
}
