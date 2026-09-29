/**
 * Unified Poster Resolution Helper
 * Checks for user-defined custom poster override first before falling back to TMDB or default placeholder.
 */

export const DEFAULT_POSTER_PLACEHOLDER =
  "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500";

interface GetPosterUrlOptions {
  movieId?: string | number | null;
  contentType?: "movie" | "tv" | string | null;
  defaultPosterPath?: string | null;
  posterPrefs?: Record<string, string> | null;
  size?: "w185" | "w342" | "w500" | "w780" | "original";
}

/**
 * Returns the resolved full poster URL.
 * Order of precedence:
 * 1. posterPrefs[`${contentType}_${movieId}`]
 * 2. posterPrefs[`${movieId}`]
 * 3. defaultPosterPath (if it starts with http://, https://, or /)
 * 4. DEFAULT_POSTER_PLACEHOLDER
 */
export function getPosterUrl({
  movieId,
  contentType = "movie",
  defaultPosterPath,
  posterPrefs,
  size = "w500",
}: GetPosterUrlOptions): string {
  const type = contentType === "tv" ? "tv" : "movie";
  const idStr = movieId ? String(movieId) : "";

  // 1. Check user override from poster preferences dictionary
  if (posterPrefs && idStr) {
    const override = posterPrefs[`${type}_${idStr}`] || posterPrefs[idStr];
    if (override && typeof override === "string" && override.trim()) {
      const cleanOverride = override.trim();
      if (cleanOverride.startsWith("http://") || cleanOverride.startsWith("https://")) {
        return cleanOverride;
      }
      return `https://image.tmdb.org/t/p/${size}${cleanOverride.startsWith("/") ? "" : "/"}${cleanOverride}`;
    }
  }

  // 2. Check defaultPosterPath
  if (defaultPosterPath && typeof defaultPosterPath === "string" && defaultPosterPath.trim()) {
    const cleanPath = defaultPosterPath.trim();
    if (cleanPath.startsWith("http://") || cleanPath.startsWith("https://")) {
      return cleanPath;
    }
    return `https://image.tmdb.org/t/p/${size}${cleanPath.startsWith("/") ? "" : "/"}${cleanPath}`;
  }

  // 3. Fallback placeholder
  return DEFAULT_POSTER_PLACEHOLDER;
}
