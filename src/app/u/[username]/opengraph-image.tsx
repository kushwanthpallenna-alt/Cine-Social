import { ImageResponse } from "next/og";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const alt = "Cine Social Profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  try {
    const { username } = await params;
    const cleanUsername = (username || "").toLowerCase();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("user_id, username, display_name, avatar_url, is_private")
      .eq("username", cleanUsername)
      .maybeSingle();

    if (!profile) {
      return new ImageResponse(
        (
          <div
            style={{
              width: "1200px",
              height: "630px",
              backgroundColor: "#09090b",
              color: "#ffffff",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "sans-serif",
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 800, color: "#e50914", letterSpacing: 3, marginBottom: 16 }}>
              CINE SOCIAL
            </div>
            <div style={{ fontSize: 44, fontWeight: 700 }}>User Not Found</div>
            <div style={{ fontSize: 20, color: "#777", marginTop: 10 }}>@{cleanUsername}</div>
          </div>
        ),
        { ...size }
      );
    }

    const isPrivate = !!profile.is_private;
    const displayName = profile.display_name || profile.username || "Cinephile";
    const avatarUrl = profile.avatar_url;

    // Private profile: Only avatar, name, and private indicator
    if (isPrivate) {
      return new ImageResponse(
        (
          <div
            style={{
              width: "1200px",
              height: "630px",
              backgroundColor: "#070709",
              backgroundImage: "linear-gradient(135deg, #180809 0%, #070709 100%)",
              color: "#ffffff",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "sans-serif",
            }}
          >
            {/* Logo Badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "8px 24px",
                borderRadius: "999px",
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                marginBottom: "36px",
              }}
            >
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "5px",
                  backgroundColor: "#e50914",
                  marginRight: "10px",
                }}
              />
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: "3px",
                  color: "#ffffff",
                  textTransform: "uppercase",
                }}
              >
                Cine Social
              </span>
            </div>

            {/* Avatar */}
            <div
              style={{
                width: "130px",
                height: "130px",
                borderRadius: "65px",
                overflow: "hidden",
                border: "4px solid rgba(255, 255, 255, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(229, 9, 20, 0.2)",
                marginBottom: "24px",
              }}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  width="130"
                  height="130"
                  style={{
                    width: "130px",
                    height: "130px",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <span style={{ fontSize: 48, fontWeight: 800, color: "#e50914" }}>
                  {displayName.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>

            {/* Names */}
            <div
              style={{
                fontSize: 46,
                fontWeight: 800,
                color: "#ffffff",
                marginBottom: "6px",
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                fontSize: 24,
                color: "#e50914",
                fontWeight: 600,
                marginBottom: "32px",
              }}
            >
              @{profile.username}
            </div>

            {/* Private Badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 28px",
                borderRadius: "999px",
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.16)",
                color: "#ffffff",
                fontSize: 18,
                fontWeight: 600,
              }}
            >
              <span style={{ marginRight: "10px" }}>🔒</span>
              <span>Private Profile</span>
            </div>
          </div>
        ),
        { ...size }
      );
    }

    // Public Profile: Count watched films and fetch top 4 posters
    const [watchedRes, favsRes] = await Promise.all([
      supabaseAdmin
        .from("watched")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profile.user_id),
      supabaseAdmin
        .from("favorites")
        .select("tmdb_id, image_url, slot_type")
        .eq("user_id", profile.user_id)
        .in("slot_type", ["movie_1", "movie_2", "movie_3", "movie_4"]),
    ]);

    const watchedCount = watchedRes.count || 0;

    // Build top 4 poster URLs
    const slotOrder = ["movie_1", "movie_2", "movie_3", "movie_4"];
    const favList = favsRes.data || [];
    favList.sort((a, b) => slotOrder.indexOf(a.slot_type) - slotOrder.indexOf(b.slot_type));

    let posterPaths: string[] = favList
      .map((f: any) => f.image_url)
      .filter(Boolean);

    if (posterPaths.length < 4) {
      const { data: recentWatched } = await supabaseAdmin
        .from("watched")
        .select("poster_path")
        .eq("user_id", profile.user_id)
        .not("poster_path", "is", null)
        .order("watched_at", { ascending: false })
        .limit(6);

      if (recentWatched) {
        for (const w of recentWatched) {
          if (w.poster_path && !posterPaths.includes(w.poster_path)) {
            posterPaths.push(w.poster_path);
            if (posterPaths.length >= 4) break;
          }
        }
      }
    }

    const finalPosters = posterPaths.slice(0, 4).map((p) => {
      if (p.startsWith("http://") || p.startsWith("https://")) return p;
      return `https://image.tmdb.org/t/p/w342${p.startsWith("/") ? "" : "/"}${p}`;
    });

    return new ImageResponse(
      (
        <div
          style={{
            width: "1200px",
            height: "630px",
            backgroundColor: "#070709",
            backgroundImage: "linear-gradient(135deg, #18090a 0%, #08080a 50%, #070709 100%)",
            color: "#ffffff",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "54px 64px",
            fontFamily: "sans-serif",
          }}
        >
          {/* Left Column: Profile Info */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              height: "522px",
              width: "440px",
            }}
          >
            {/* Header Brand */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "6px",
                  backgroundColor: "#e50914",
                  marginRight: "10px",
                }}
              />
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  letterSpacing: "4px",
                  color: "#ffffff",
                  textTransform: "uppercase",
                }}
              >
                Cine Social
              </span>
            </div>

            {/* User Details */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: "104px",
                  height: "104px",
                  borderRadius: "52px",
                  overflow: "hidden",
                  border: "3px solid rgba(255, 255, 255, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(229, 9, 20, 0.25)",
                  marginBottom: "18px",
                }}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    width="104"
                    height="104"
                    style={{
                      width: "104px",
                      height: "104px",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <span style={{ fontSize: 38, fontWeight: 800, color: "#e50914" }}>
                    {displayName.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>

              <div
                style={{
                  fontSize: 40,
                  fontWeight: 800,
                  color: "#ffffff",
                  lineHeight: 1.15,
                }}
              >
                {displayName}
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  color: "#e50914",
                  marginTop: "6px",
                  marginBottom: "16px",
                }}
              >
                @{profile.username}
              </div>

              {/* Films Count Stat Badge */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "10px 20px",
                  borderRadius: "14px",
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.14)",
                  width: "fit-content",
                }}
              >
                <span style={{ fontSize: 22, marginRight: "8px" }}>🎬</span>
                <span style={{ fontSize: 19, fontWeight: 700, color: "#ffffff" }}>
                  {watchedCount} {watchedCount === 1 ? "Film" : "Films"} Watched
                </span>
              </div>
            </div>

            {/* Footer watermark */}
            <div
              style={{
                fontSize: 14,
                color: "rgba(255, 255, 255, 0.4)",
                letterSpacing: "1px",
              }}
            >
              Track & share cinema with friends
            </div>
          </div>

          {/* Right Column: Top 4 Posters */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              height: "522px",
            }}
          >
            {finalPosters.length > 0 ? (
              finalPosters.map((posterUrl, idx) => (
                <div
                  key={idx}
                  style={{
                    width: "140px",
                    height: "215px",
                    borderRadius: "14px",
                    overflow: "hidden",
                    border: "2px solid rgba(255, 255, 255, 0.18)",
                    display: "flex",
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    marginLeft: idx > 0 ? "16px" : "0px",
                    marginTop: idx % 2 === 0 ? "-16px" : "16px",
                  }}
                >
                  <img
                    src={posterUrl}
                    alt={`Top film ${idx + 1}`}
                    width="140"
                    height="215"
                    style={{
                      width: "140px",
                      height: "215px",
                      objectFit: "cover",
                    }}
                  />
                </div>
              ))
            ) : (
              <div
                style={{
                  width: "440px",
                  height: "220px",
                  borderRadius: "20px",
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  border: "1px dashed rgba(255, 255, 255, 0.15)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(255, 255, 255, 0.5)",
                }}
              >
                <span style={{ fontSize: 44, marginBottom: "8px" }}>🍿</span>
                <span style={{ fontSize: 18, fontWeight: 600 }}>Cinephile in the Making</span>
              </div>
            )}
          </div>
        </div>
      ),
      { ...size }
    );
  } catch (error) {
    console.error("OpenGraph image generation error:", error);
    return new ImageResponse(
      (
        <div
          style={{
            width: "1200px",
            height: "630px",
            backgroundColor: "#070709",
            color: "#ffffff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: 32, fontWeight: 800, color: "#e50914" }}>CINE SOCIAL</div>
          <div style={{ fontSize: 24, marginTop: 12 }}>Film Social Club</div>
        </div>
      ),
      { ...size }
    );
  }
}
