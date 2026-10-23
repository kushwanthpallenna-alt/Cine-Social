import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import PublicProfilePage from "@/app/profile/[userId]/page";

interface PageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const cleanUsername = (username || "").toLowerCase();

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("user_id, username, display_name, avatar_url, bio, is_private")
    .eq("username", cleanUsername)
    .maybeSingle();

  if (!profile) {
    return {
      title: "User Not Found | Cine Social",
      description: "This Cine Social profile does not exist.",
    };
  }

  const displayName = profile.display_name || profile.username || "Cinephile";
  const title = `${displayName} (@${profile.username}) | Cine Social`;

  if (profile.is_private) {
    return {
      title,
      description: `Private profile of ${displayName} on Cine Social.`,
      openGraph: {
        title,
        description: `Private profile of ${displayName} on Cine Social.`,
        type: "profile",
        username: profile.username,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description: `Private profile of ${displayName} on Cine Social.`,
      },
    };
  }

  const { count: watchedCount } = await supabaseAdmin
    .from("watched")
    .select("*", { count: "exact", head: true })
    .eq("user_id", profile.user_id);

  const filmsCount = watchedCount || 0;
  const description = `${displayName} has watched ${filmsCount} ${
    filmsCount === 1 ? "film" : "films"
  }. Check out their profile, reviews, and film collection on Cine Social.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      username: profile.username,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function UserProfileRoute({ params }: PageProps) {
  // Await params per Next.js App Router requirements
  await params;
  return <PublicProfilePage />;
}
