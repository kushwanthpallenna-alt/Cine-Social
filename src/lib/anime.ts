/**
 * Detects if a TMDB media item / TV show is an Anime based on official TMDB information:
 * 1. Has "Animation" genre (ID 16 or name "Animation")
 * 2. Has Japanese origin (original_language === "ja", origin_country contains "JP", or production country "JP")
 *    OR contains anime keywords in TMDB keywords.
 */
export function isAnimeShow(detail: any): boolean {
  if (!detail) return false;

  const genres = Array.isArray(detail.genres) ? detail.genres : [];
  const genreIds = Array.isArray(detail.genre_ids) ? detail.genre_ids : [];
  const hasAnimation =
    genres.some(
      (g: any) =>
        g?.id === 16 ||
        (typeof g === "string" && g.toLowerCase() === "animation") ||
        g?.name?.toLowerCase() === "animation"
    ) ||
    genreIds.includes(16) ||
    genreIds.includes("16");

  const origLang = detail.original_language?.toLowerCase();
  const originCountry = Array.isArray(detail.origin_country) ? detail.origin_country : [];
  const prodCountries = Array.isArray(detail.production_countries) ? detail.production_countries : [];
  const isJapanese =
    origLang === "ja" ||
    origLang === "jpn" ||
    originCountry.some((c: string) => String(c).toUpperCase() === "JP") ||
    prodCountries.some(
      (c: any) =>
        c?.iso_3166_1?.toUpperCase() === "JP" || c?.name?.toLowerCase() === "japan"
    );

  const keywords = detail.keywords?.results || detail.keywords || [];
  const hasAnimeKeyword =
    Array.isArray(keywords) &&
    keywords.some((k: any) => {
      const name = (typeof k === "string" ? k : k?.name || "").toLowerCase();
      return name === "anime" || name.includes("anime");
    });

  return Boolean((hasAnimation && isJapanese) || (isJapanese && hasAnimeKeyword));
}
