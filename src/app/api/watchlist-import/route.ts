import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseSecret = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseSecret);

const TMDB_API_KEY = process.env.TMDB_API_KEY || "";
const TMDB_BASE = "https://api.themoviedb.org/3";

interface CsvRow {
  Date?: string;
  Name?: string;
  Year?: string;
  Rating?: string;
  "Letterboxd URI"?: string;
  TMDB_ID?: string;
  Content_Type?: string;
  [key: string]: string | undefined;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row: any = {};
    headers.forEach((h, i) => {
      row[h.trim()] = (values[i] || "").trim();
    });
    return row;
  });
}

function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

async function searchTmdb(title: string, year?: string): Promise<{ id: number; title: string; content_type: string; poster_path: string } | null> {
  try {
    const yearParam = year ? `&year=${year}` : "";
    const res = await fetch(
      `${TMDB_BASE}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}${yearParam}&page=1`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const results = (data.results || []).filter((r: any) => r.media_type === "movie" || r.media_type === "tv");
    if (results.length === 0) return null;
    const best = results[0];
    return {
      id: best.id,
      title: best.title || best.name || title,
      content_type: best.media_type,
      poster_path: best.poster_path || "",
    };
  } catch {
    return null;
  }
}

// POST /api/watchlist-import
// Body: FormData with file (CSV) + userId + mode/importType
// Supports Letterboxd watchlist and diary export formats
// Also supports Letterboxd ratings export (Rating column: 0.5–5) → ×2 → 10-point scale
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const userId = formData.get("userId") as string;
    const file = formData.get("file") as File;
    const importType = ((formData.get("mode") as string) || (formData.get("importType") as string) || "watchlist").toLowerCase(); // "watchlist" | "watched" | "ratings" | "both"

    if (!userId || !file) {
      return NextResponse.json({ error: "Missing userId or file" }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCsv(text);

    if (rows.length === 0) {
      return NextResponse.json({ error: "CSV is empty or could not be parsed" }, { status: 400 });
    }

    // Prefetch existing records for duplicate detection
    const [watchlistRes, watchedRes, ratingsRes] = await Promise.all([
      supabaseAdmin.from("watchlist").select("movie_id").eq("user_id", userId),
      supabaseAdmin.from("watched").select("movie_id").eq("user_id", userId),
      supabaseAdmin.from("ratings").select("movie_id").eq("user_id", userId),
    ]);

    const existingWatchlist = new Set((watchlistRes.data || []).map((r: any) => String(r.movie_id)));
    const existingWatched = new Set((watchedRes.data || []).map((r: any) => String(r.movie_id)));
    const existingRatings = new Set((ratingsRes.data || []).map((r: any) => String(r.movie_id)));

    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    const matched: string[] = [];
    const unmatched: string[] = [];
    const ratingsAdded: string[] = [];

    // Process rows in batches of 5 to avoid rate limiting
    const BATCH_SIZE = 5;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (row) => {
          const title = row["Name"] || row["Title"] || row["name"] || "";
          const year = row["Year"] || row["year"] || "";
          const rawRating = row["Rating"] || row["rating"] || "";

          // Check if TMDB_ID is directly present (from our own export)
          const directTmdbId = row["TMDB_ID"] || "";
          const directContentType = row["Content_Type"] || "";

          if (!title && !directTmdbId) {
            return;
          }

          let result: { id: number; title: string; content_type: string; poster_path: string } | null = null;

          if (directTmdbId) {
            // Fast path: direct TMDB ID from our own export
            result = {
              id: parseInt(directTmdbId),
              title,
              content_type: directContentType || "movie",
              poster_path: "",
            };
          } else {
            result = await searchTmdb(title, year || undefined);
          }

          if (!result) {
            unmatched.push(title || directTmdbId);
            errors.push(`Could not find "${title || directTmdbId}" on TMDB`);
            return;
          }

          const movieIdStr = String(result.id);
          let wasImported = false;
          let wasSkipped = false;

          if (importType === "watchlist" || importType === "both") {
            if (existingWatchlist.has(movieIdStr)) {
              wasSkipped = true;
            } else {
              try {
                const { error } = await supabaseAdmin.from("watchlist").insert({
                  user_id: userId,
                  movie_id: movieIdStr,
                  movie_title: result.title,
                  poster_path: result.poster_path,
                  content_type: result.content_type,
                });
                if (!error) {
                  existingWatchlist.add(movieIdStr);
                  matched.push(result.title);
                  wasImported = true;
                } else {
                  errors.push(`Failed to add "${result.title}" to watchlist: ${error.message}`);
                }
              } catch (err: any) {
                errors.push(`Error adding "${result.title}" to watchlist: ${err.message}`);
              }
            }
          }

          if (importType === "watched") {
            if (existingWatched.has(movieIdStr)) {
              wasSkipped = true;
            } else {
              try {
                const watchedAt = row["Date"] ? new Date(row["Date"]).toISOString() : new Date().toISOString();
                const { error } = await supabaseAdmin.from("watched").insert({
                  user_id: userId,
                  movie_id: movieIdStr,
                  movie_title: result.title,
                  poster_path: result.poster_path,
                  content_type: result.content_type,
                  watched_at: watchedAt,
                });
                if (!error) {
                  existingWatched.add(movieIdStr);
                  matched.push(result.title);
                  wasImported = true;
                } else {
                  errors.push(`Failed to add "${result.title}" to watched: ${error.message}`);
                }
              } catch (err: any) {
                errors.push(`Error adding "${result.title}" to watched: ${err.message}`);
              }
            }
          }

          // Handle ratings import with scale conversion (0.5–5★ to 1–10)
          if ((importType === "ratings" || importType === "both" || importType === "watched") && rawRating) {
            const starRating = parseFloat(rawRating);
            if (!isNaN(starRating) && starRating > 0) {
              const convertedRating = Math.min(10, Math.max(1, Math.round(starRating * 2 * 2) / 2));
              try {
                const { error } = await supabaseAdmin.from("ratings").upsert(
                  {
                    user_id: userId,
                    movie_id: movieIdStr,
                    rating: convertedRating,
                    liked: convertedRating >= 7,
                    content_type: result.content_type,
                    created_at: new Date().toISOString(),
                  },
                  { onConflict: "user_id,movie_id,content_type" }
                );
                if (!error) {
                  ratingsAdded.push(`${result.title} (${starRating}★ → ${convertedRating}/10)`);
                  if (importType === "ratings") {
                    if (existingRatings.has(movieIdStr)) {
                      wasSkipped = true;
                    } else {
                      existingRatings.add(movieIdStr);
                      matched.push(result.title);
                      wasImported = true;
                    }
                  }
                }
              } catch (err: any) {
                errors.push(`Failed to save rating for "${result.title}": ${err.message}`);
              }
            }
          }

          if (wasImported) {
            importedCount++;
          } else if (wasSkipped) {
            skippedCount++;
          }
        })
      );
    }

    return NextResponse.json({
      success: true,
      imported: importedCount,
      skipped: skippedCount,
      errors,
      total: rows.length,
      matched: matched.length,
      unmatched: unmatched.length,
      ratingsAdded: ratingsAdded.length,
      unmatchedTitles: unmatched,
      ratingsAddedList: ratingsAdded,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        imported: 0,
        skipped: 0,
        errors: [err.message || "An unexpected error occurred during import"],
        error: err.message,
      },
      { status: 500 }
    );
  }
}
