/**
 * Utility to validate and sanitize user avatar URLs.
 * Ensures the URL is well-formed and originates from a trusted image host
 * configured in next.config.ts (Google, Supabase, Unsplash, TMDB).
 */

// Minimal inline SVG — generic person silhouette used when no avatar URL is available.
export const DEFAULT_AVATAR_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' fill='%23222'/%3E%3Ccircle cx='40' cy='30' r='14' fill='%23555'/%3E%3Cellipse cx='40' cy='72' rx='24' ry='20' fill='%23555'/%3E%3C/svg%3E";

const ALLOWED_HOST_DOMAINS = [
  "googleusercontent.com",
  "supabase.co",
  "supabase.in",
  "unsplash.com",
  "tmdb.org",
];

export function isValidAvatarUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();
    return ALLOWED_HOST_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith("." + domain)
    );
  } catch {
    return false;
  }
}

export function getSafeAvatarUrl(url?: string | null): string | null {
  return isValidAvatarUrl(url) ? url!.trim() : null;
}

export function getAvatarUrlOrDefault(url?: string | null, fallback: string = DEFAULT_AVATAR_URL): string {
  return getSafeAvatarUrl(url) || fallback;
}

