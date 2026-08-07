/**
 * Utility to validate and sanitize user avatar URLs.
 * Ensures the URL is well-formed and originates from a trusted image host
 * configured in next.config.ts (Google, Supabase, Unsplash, TMDB).
 */

export const DEFAULT_AVATAR_URL =
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150";

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

export function getAvatarUrlOrDefault(url?: string | null, fallback = DEFAULT_AVATAR_URL): string {
  return getSafeAvatarUrl(url) || fallback;
}
