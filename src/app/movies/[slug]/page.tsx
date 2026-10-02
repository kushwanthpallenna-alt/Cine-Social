import React, { Suspense } from "react";
import type { Metadata } from "next";
import MovieDetailsClient, { DetailsSkeleton } from "@/components/MovieDetailsClient";
import { extractIdFromSlug } from "@/lib/slug";

interface MoviePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: MoviePageProps): Promise<Metadata> {
  const { slug } = await params;
  const movieId = extractIdFromSlug(slug);

  if (!movieId) {
    return {
      title: "Movie Details | CineSocial",
    };
  }

  try {
    const apiKey = process.env.TMDB_API_KEY;
    const res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${apiKey}`, {
      next: { revalidate: 3600 },
    });

    if (res.ok) {
      const data = await res.json();
      const title = data.title || data.name || "Movie";
      const year = data.release_date ? ` (${data.release_date.slice(0, 4)})` : "";
      const description = data.overview || `Discover ratings, reviews, and streaming options for ${title} on CineSocial.`;
      const posterUrl = data.poster_path
        ? `https://image.tmdb.org/t/p/w780${data.poster_path}`
        : "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=780";

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
          type: "video.movie",
          siteName: "CineSocial",
        },
        twitter: {
          card: "summary_large_image",
          title: `${title}${year} | CineSocial`,
          description,
          images: [posterUrl],
        },
      };
    }
  } catch (error) {
    console.error("Failed to generate metadata for movie:", error);
  }

  return {
    title: "Movie Details | CineSocial",
  };
}

export default async function MovieSlugPage({ params }: MoviePageProps) {
  const { slug } = await params;
  const movieId = extractIdFromSlug(slug);

  return (
    <Suspense fallback={<DetailsSkeleton />}>
      <MovieDetailsClient movieId={movieId} initialSlug={slug} />
    </Suspense>
  );
}
