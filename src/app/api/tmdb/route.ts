import { NextResponse } from "next/server";

async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delay = 500): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || (response.status < 500 && response.status !== 429)) {
        return response;
      }
      console.warn(`Attempt ${i + 1} failed with status ${response.status}. Retrying...`);
    } catch (error) {
      if (i === retries - 1) throw error;
      console.warn(`Attempt ${i + 1} failed with error. Retrying...`, error);
    }
    await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
  }
  return fetch(url, options);
}

// Generate normalized query variants to fix TMDB API quirks with punctuation/special characters (like "WALL·E")
function getSearchQueryVariants(rawQuery: string): string[] {
  if (!rawQuery) return [];
  const q = rawQuery.trim();
  const variants: string[] = [];
  const added = new Set<string>();

  const add = (v: string) => {
    const trimmed = v.trim();
    if (trimmed && !added.has(trimmed.toLowerCase())) {
      added.add(trimmed.toLowerCase());
      variants.push(trimmed);
    }
  };

  // 1. Interpunct middle-dot variant (TMDB quirk for titles like WALL·E)
  // Replaces hyphens, dots, or spaces between words/letters with middle dot '·'
  const interpunct = q.replace(/([a-zA-Z0-9]+)[-.\s]+([a-zA-Z0-9])\b/gi, "$1·$2");
  if (interpunct !== q) {
    add(interpunct);
  }

  // 2. Exact user query
  add(q);

  // 3. Special alias for "walle" / "wall e" -> "WALL·E"
  const cleanAlpha = q.toLowerCase().replace(/[\s-.]/g, "");
  if (cleanAlpha === "walle") {
    add("WALL·E");
    add("Wall-E");
  }

  // 4. Hyphen to space variant: "Spider-Man" -> "Spider Man"
  if (q.includes("-")) {
    add(q.replace(/-/g, " "));
  }

  // 5. Strip non-alphanumeric punctuation: "E.T." -> "E T"
  const cleanPunctuation = q.replace(/[^\w\s]/gi, " ").replace(/\s+/g, " ");
  if (cleanPunctuation !== q) {
    add(cleanPunctuation);
  }

  return variants;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint");

  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint parameter is required" }, { status: 400 });
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TMDB API key is not configured" }, { status: 500 });
  }

  // Handle movie searches with query normalization and variant merging
  if ((endpoint === "search/movie" || endpoint === "search/multi") && searchParams.has("query")) {
    const rawQuery = searchParams.get("query") || "";
    const queryVariants = getSearchQueryVariants(rawQuery);

    const tmdbBaseParams = new URLSearchParams();
    tmdbBaseParams.set("api_key", apiKey);
    for (const [key, value] of searchParams.entries()) {
      if (key !== "endpoint" && key !== "query") {
        tmdbBaseParams.set(key, value);
      }
    }

    try {
      const mergedResults: any[] = [];
      const seenIds = new Set<number>();

      for (const variant of queryVariants) {
        const variantParams = new URLSearchParams(tmdbBaseParams);
        variantParams.set("query", variant);
        const targetUrl = `https://api.themoviedb.org/3/${endpoint}?${variantParams.toString()}`;

        try {
          const res = await fetchWithRetry(targetUrl, { next: { revalidate: 3600 } });
          if (res.ok) {
            const data = await res.json();
            if (data?.results && Array.isArray(data.results)) {
              for (const item of data.results) {
                if (!seenIds.has(item.id)) {
                  seenIds.add(item.id);
                  mergedResults.push(item);
                }
              }
            }
          }
        } catch (e) {
          console.warn(`Variant fetch failed for query "${variant}":`, e);
        }
      }

      // Sort merged results by relevance to raw query
      mergedResults.sort((a, b) => {
        const titleA = (a.title || a.name || "").toLowerCase();
        const titleB = (b.title || b.name || "").toLowerCase();
        const cleanQ = rawQuery.toLowerCase().replace(/[^\w]/g, "");

        const cleanA = titleA.replace(/[^\w]/g, "");
        const cleanB = titleB.replace(/[^\w]/g, "");

        // Exact match priority (ignoring punctuation/spaces)
        const exactA = cleanA === cleanQ;
        const exactB = cleanB === cleanQ;
        if (exactA && !exactB) return -1;
        if (!exactA && exactB) return 1;

        // Title starts with clean query priority
        const startsA = cleanA.startsWith(cleanQ);
        const startsB = cleanB.startsWith(cleanQ);
        if (startsA && !startsB) return -1;
        if (!startsA && startsB) return 1;

        // Popularity tie-breaker
        return (b.popularity || 0) - (a.popularity || 0);
      });

      return NextResponse.json({
        page: 1,
        results: mergedResults,
        total_results: mergedResults.length,
        total_pages: 1,
      }, {
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
        },
      });
    } catch (error: any) {
      return NextResponse.json(
        { error: "Internal Server Error during search proxy", details: error?.message || error },
        { status: 500 }
      );
    }
  }

  // Standard non-search TMDB API Proxy
  const tmdbParams = new URLSearchParams();
  tmdbParams.set("api_key", apiKey);
  for (const [key, value] of searchParams.entries()) {
    if (key !== "endpoint") {
      tmdbParams.set(key, value);
    }
  }

  const targetUrl = `https://api.themoviedb.org/3/${endpoint}?${tmdbParams.toString()}`;

  try {
    const response = await fetchWithRetry(targetUrl, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `TMDB API returned error status ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Internal Server Error during fetch proxy", details: error?.message || error },
      { status: 500 }
    );
  }
}
