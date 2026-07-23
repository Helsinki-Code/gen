import Link from "next/link";
import { Headphones, Radio, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AudioPlayerProvider,
  AudioPlayerButton,
  AudioPlayerProgress,
  AudioPlayerTime,
  AudioPlayerDuration,
  AudioPlayerSpeed,
} from "@/components/ui/audio-player";
import { getPublicPodcastArchive, podcastAudioUrl, podcastEpisodePath, podcastMinutes } from "@/lib/podcasts";

export default async function PodcastHomeSection() {
  const { episodes, error } = await getPublicPodcastArchive(3);
  const featured = episodes[0];
  const rest = episodes.slice(1);

  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="secondary" className="mb-4">AmroGen Growth Brief</Badge>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Listen to the latest AI sales briefings.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Short podcast episodes on AI SDR workflows, B2B lead generation, cold outreach quality, and AmroGen product updates.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/podcasts">
            Browse podcasts
            <Headphones size={16} />
          </Link>
        </Button>
      </div>

      <AudioPlayerProvider>
        <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">

          {/* Featured episode */}
          <article className="overflow-hidden rounded-2xl border border-border bg-card/75">
            <div className="grid min-h-[300px] gap-0 md:grid-cols-[0.9fr_1.1fr]">
              {/* Left visual panel */}
              <div className="relative flex flex-col justify-between bg-secondary/60 p-6">
                <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(90deg,hsl(var(--primary)/0.14)_1px,transparent_1px),linear-gradient(0deg,hsl(var(--primary)/0.12)_1px,transparent_1px)] [background-size:24px_24px]" />
                <div className="relative">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                    <Radio size={24} />
                  </div>
                  <div className="mt-8 flex items-end gap-1.5">
                    {[34, 54, 28, 74, 46, 88, 40, 62, 30, 70, 38, 52].map((height, index) => (
                      <span
                        key={index}
                        className="w-2 rounded-full bg-primary/70"
                        style={{ height }}
                      />
                    ))}
                  </div>
                </div>
                <div className="relative mt-8 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {featured ? `${podcastMinutes(featured)} min briefing` : "Public archive"}
                </div>
              </div>

              {/* Right content + player */}
              <div className="flex flex-col p-6">
                <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-primary">
                  <Sparkles size={14} />
                  {featured ? "Latest episode" : "Podcast studio"}
                </div>
                <h3 className="text-xl font-semibold leading-snug">
                  {featured ? (
                    <Link href={podcastEpisodePath(featured)} className="hover:text-primary">
                      {featured.title}
                    </Link>
                  ) : error ? (
                    "Podcast feed temporarily unavailable"
                  ) : (
                    "No published episodes yet."
                  )}
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground flex-1">
                  {featured?.summary ||
                    (error
                      ? `Backend unreachable: ${error} Check that the API server is running.`
                      : "Published episodes from Podcast Studio will appear here automatically.")}
                </p>

                {featured?.audio_url && (
                  <div className="mt-5 rounded-xl border border-border bg-background/60 p-3">
                    <div className="flex items-center gap-3">
                      <AudioPlayerButton
                        item={{ id: featured.id, src: podcastAudioUrl(featured) }}
                        size="icon"
                        className="h-9 w-9 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                      />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <AudioPlayerProgress className="w-full" />
                        <div className="flex items-center justify-between">
                          <AudioPlayerTime className="text-xs" />
                          <AudioPlayerDuration className="text-xs" />
                        </div>
                      </div>
                      <AudioPlayerSpeed className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </article>

          {/* Rest episodes */}
          <div className="grid gap-4">
            {rest.length > 0 ? rest.map((episode) => (
              <article key={episode.id} className="rounded-2xl border border-border bg-card/75 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold leading-snug">
                    <Link href={podcastEpisodePath(episode)} className="hover:text-primary">
                      {episode.title}
                    </Link>
                  </h3>
                  <Badge variant="secondary" className="shrink-0">{podcastMinutes(episode)} min</Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{episode.summary}</p>
                {episode.audio_url && (
                  <div className="mt-4 rounded-xl border border-border bg-background/60 p-3">
                    <div className="flex items-center gap-3">
                      <AudioPlayerButton
                        item={{ id: episode.id, src: podcastAudioUrl(episode) }}
                        size="icon"
                        className="h-8 w-8 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <AudioPlayerProgress className="w-full" />
                        <div className="flex items-center justify-between">
                          <AudioPlayerTime className="text-xs" />
                          <AudioPlayerDuration className="text-xs" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            )) : (
              <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
                <Radio size={28} className="mb-3 text-primary/40" />
                <p className="text-sm">More episodes coming soon</p>
              </div>
            )}
          </div>
        </div>
      </AudioPlayerProvider>
    </section>
  );
}
