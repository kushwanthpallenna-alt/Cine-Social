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

  // Build the target TMDB URL
  const tmdbParams = new URLSearchParams();
  tmdbParams.set("api_key", apiKey);

  // Forward all other search parameters
  for (const [key, value] of searchParams.entries()) {
    if (key !== "endpoint") {
      tmdbParams.set(key, value);
    }
  }

  const targetUrl = `https://api.themoviedb.org/3/${endpoint}?${tmdbParams.toString()}`;

  try {
    const response = await fetchWithRetry(targetUrl, {
      next: { revalidate: 3600 }, // Cache response for 1 hour
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
