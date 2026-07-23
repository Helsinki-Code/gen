import { getBackendUrl } from "@/lib/server/backend-url";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://amrogen.com";
const PODCAST_FETCH_TIMEOUT_MS = Number(process.env.PODCAST_FETCH_TIMEOUT_MS || 8000);

export interface PublicPodcastEpisode {
  id: string;
  title: string;
  topic: string;
  source_type: string;
  source_url: string | null;
  audience: string;
  tone: string;
  duration_minutes: number;
  summary: string;
  show_notes: string;
  audio_url: string | null;
  audio_mime_type: string | null;
  duration_seconds: number | null;
  cover_image_url: string | null;
  cover_image_mime_type: string | null;
  cover_image_alt: string | null;
  cover_image_prompt: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_content: string | null;
  seo_keywords: string[];
  seo_faq: Array<{ question: string; answer: string }>;
  publish_url: string | null;
  created_at: string;
  published_at: string | null;
}

export interface PublicPodcastFetchResult {
  episodes: PublicPodcastEpisode[];
  error: string | null;
}

export async function getPublicPodcastArchive(limit = 6): Promise<PublicPodcastFetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PODCAST_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${getBackendUrl()}/podcasts/public?per_page=${limit}`, {
      cache: "no-store",
      next: { revalidate: 0 },
      signal: controller.signal,
    });
    if (!response.ok) {
      return {
        episodes: [],
        error: `Podcast API returned HTTP ${response.status}.`,
      };
    }
    return {
      episodes: (await response.json()) as PublicPodcastEpisode[],
      error: null,
    };
  } catch (err: unknown) {
    return {
      episodes: [],
      error:
        err instanceof Error && err.name === "AbortError"
          ? `Podcast API did not respond within ${Math.round(PODCAST_FETCH_TIMEOUT_MS / 1000)} seconds.`
          : "Podcast API is not reachable from the public page.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getPublicPodcasts(limit = 6): Promise<PublicPodcastEpisode[]> {
  const result = await getPublicPodcastArchive(limit);
  return result.episodes;
}

export async function getPublicPodcast(id: string): Promise<PublicPodcastEpisode | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PODCAST_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${getBackendUrl()}/podcasts/public/${encodeURIComponent(id)}`, {
      cache: "no-store",
      next: { revalidate: 0 },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as PublicPodcastEpisode;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function podcastAudioUrl(episode: PublicPodcastEpisode) {
  const base = getBackendUrl();
  return episode.audio_url ? `${base}${episode.audio_url}` : "";
}

export function podcastEpisodePath(episode: Pick<PublicPodcastEpisode, "id">) {
  return `/podcasts/${episode.id}`;
}

export function podcastCoverImagePath(
  episode: Pick<PublicPodcastEpisode, "id"> & Partial<Pick<PublicPodcastEpisode, "cover_image_url">>
) {
  const cover = episode.cover_image_url || null;
  return cover ? `${getBackendUrl()}${cover}` : `/podcasts/${episode.id}/cover-image`;
}

export function podcastPublicUrl(episode: PublicPodcastEpisode) {
  return `${SITE_URL}${podcastEpisodePath(episode)}`;
}

export function podcastMinutes(episode: PublicPodcastEpisode) {
  if (episode.duration_seconds) return Math.max(1, Math.round(episode.duration_seconds / 60));
  return episode.duration_minutes;
}
