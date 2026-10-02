import React, { Suspense } from "react";
import type { Metadata } from "next";
import TvDetailsClient, { DetailsSkeleton } from "@/components/TvDetailsClient";
import { extractIdFromSlug } from "@/lib/slug";

interface TvPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: TvPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tvId = extractIdFromSlug(slug);

  if (!tvId) {
    return {
      title: "TV Show Details | CineSocial",
    };
  }

  try {
    const apiKey = process.env.TMDB_API_KEY;
    const res = await fetch(`https://api.themoviedb.org/3/tv/${tvId}?api_key=${apiKey}`, {
      next: { revalidate: 3600 },
    });

    if (res.ok) {
      const data = await res.json();
      const title = data.name || "TV Show";
      const year = data.first_air_date ? ` (${data.first_air_date.slice(0, 4)})` : "";
      const description = data.overview || `Discover ratings, reviews, and episodes for ${title} on CineSocial.`;
      const posterUrl = data.poster_path
        ? `https://image.tmdb.org/t/p/w780${data.poster_path}`
        : "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=780";

      return {
        title: `${title}${year} | CineSocial`,
        description,
        openGraph: {
          title: `${title}${year} | CineSocial`,
          description,
          images: [
            {
              url: posterUrl,
              width: 780,
              height: 1170,
              alt: title,
            },
          ],
          type: "video.tv_show",
          siteName: "CineSocial",
        },
        twitter: {
          card: "summary_large_image",
          title: `${title}${year}`,
          description,
          images: [posterUrl],
        },
      };
    }
  } catch (error) {
    console.error("Failed to generate metadata for TV show:", error);
  }

  return {
    title: "TV Show Details | CineSocial",
  };
}

export default async function TvSlugPage({ params }: TvPageProps) {
  const { slug } = await params;
  const tvId = extractIdFromSlug(slug);

  return (
    <Suspense fallback={<DetailsSkeleton />}>
      <TvDetailsClient tvId={tvId} initialSlug={slug} />
    </Suspense>
  );
}
