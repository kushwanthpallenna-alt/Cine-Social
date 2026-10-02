/**
 * URL Slug generation and parsing utilities for Movies and TV Shows.
 * Format: /movies/the-love-hypothesis-1032863 or /tv/breaking-bad-1396
 */

export function slugify(text?: string | null): string {
  if (!text || typeof text !== "string") return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Generates movie URL with slug and TMDB ID: /movies/the-love-hypothesis-1032863
 */
export function getMovieUrl(id: string | number, title?: string | null): string {
  const cleanId = String(id).trim();
  const slug = slugify(title);
  return slug ? `/movies/${slug}-${cleanId}` : `/movies/${cleanId}`;
}

/**
 * Generates TV URL with slug and TMDB ID: /tv/breaking-bad-1396
 */
export function getTvUrl(id: string | number, title?: string | null): string {
  const cleanId = String(id).trim();
  const slug = slugify(title);
  return slug ? `/tv/${slug}-${cleanId}` : `/tv/${cleanId}`;
}

/**
 * Generic media URL helper that routes to movie or tv based on media type
 */
export function getMediaUrl(id: string | number, type: "movie" | "tv" | string = "movie", title?: string | null): string {
  return type === "tv" ? getTvUrl(id, title) : getMovieUrl(id, title);
}

/**
 * Extracts the trailing numeric TMDB ID from a slug.
 * E.g. "the-love-hypothesis-1032863" -> "1032863", "1032863" -> "1032863"
 */
export function extractIdFromSlug(slug: string): string {
  if (!slug) return "";
  const match = slug.match(/(?:^|-)(\d+)$/);
  return match ? match[1] : slug;
}
