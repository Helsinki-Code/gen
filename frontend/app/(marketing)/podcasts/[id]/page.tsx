import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, ExternalLink, Headphones, Radio, Sparkles } from "lucide-react";
import { JsonLd, MarketingFooter, MarketingNav } from "@/components/MarketingPage";
import PodcastAudioPlayer from "@/components/PodcastAudioPlayer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getPublicPodcast,
  podcastAudioUrl,
  podcastCoverImagePath,
  podcastMinutes,
  podcastPublicUrl,
} from "@/lib/podcasts";
import { siteUrl } from "@/lib/marketing-content";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const episode = await getPublicPodcast(id);
  if (!episode) return {};

  const title = `${episode.title} | AmroGen Growth Brief Podcast`;
  const seoTitle = episode.seo_title || title;
  const description =
    episode.seo_description ||
    episode.summary ||
    `Listen to this AmroGen Growth Brief episode about ${episode.topic}, AI SDR workflows, B2B lead generation, and outbound strategy.`;
  const image = absoluteAssetUrl(podcastCoverImagePath(episode));

  return {
    title: seoTitle,
    description,
    keywords: episode.seo_keywords?.length ? episode.seo_keywords : undefined,
    alternates: { canonical: `/podcasts/${episode.id}` },
    openGraph: {
      title: seoTitle,
      description,
      type: "article",
      url: `${siteUrl}/podcasts/${episode.id}`,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: episode.cover_image_alt || `${episode.title} podcast cover image`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: seoTitle,
      description,
      images: [image],
    },
  };
}

export default async function PodcastEpisodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const episode = await getPublicPodcast(id);
  if (!episode) notFound();

  const audioUrl = podcastAudioUrl(episode);
  const coverPath = podcastCoverImagePath(episode);
  const coverUrl = absoluteAssetUrl(coverPath);
  const publishedDate = episode.published_at || episode.created_at;
  const seoContent = episode.seo_content || fallbackSeoContent(episode);
  const faqs = episode.seo_faq?.length ? episode.seo_faq : fallbackFaqs(episode);

  return (
    <main className="min-h-screen overflow-hidden bg-background">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "PodcastEpisode",
          name: episode.title,
          headline: episode.title,
          description: episode.summary,
          url: podcastPublicUrl(episode),
          datePublished: publishedDate,
          duration: `PT${Math.max(1, podcastMinutes(episode))}M`,
          image: coverUrl,
          keywords: episode.seo_keywords,
          partOfSeries: {
            "@type": "PodcastSeries",
            name: "AmroGen Growth Brief",
            url: `${siteUrl}/podcasts`,
          },
          associatedMedia: audioUrl
            ? {
                "@type": "MediaObject",
                contentUrl: audioUrl,
                encodingFormat: episode.audio_mime_type || "audio/mpeg",
              }
            : undefined,
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ImageObject",
          url: coverUrl,
          width: 1200,
          height: 630,
          caption: episode.cover_image_alt || `${episode.title} podcast cover`,
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: faq.answer,
            },
          })),
        }}
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,hsl(var(--background)),hsl(var(--secondary)))]" />
      <div className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.20),transparent_64%)]" />
      <MarketingNav />

      <article className="mx-auto max-w-6xl px-6 py-14 lg:py-20">
        <Button asChild variant="ghost" className="mb-8 -ml-3">
          <Link href="/podcasts">
            <ArrowLeft size={16} />
            Back to podcasts
          </Link>
        </Button>

        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <img
              src={coverPath}
              alt={episode.cover_image_alt || `${episode.title} podcast cover`}
              className="aspect-[1200/630] w-full rounded-3xl border border-primary/25 object-cover shadow-2xl"
            />
            <div className="mt-4 rounded-2xl border border-border bg-card/75 p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Headphones size={16} className="text-primary" />
                Listen to this episode
              </div>
              {audioUrl ? (
                <PodcastAudioPlayer src={audioUrl} cover={coverPath} title={episode.title} />
              ) : (
                <p className="text-sm text-muted-foreground">Audio is being prepared.</p>
              )}
            </div>
          </div>

          <div>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <Badge>AmroGen Growth Brief</Badge>
              <Badge variant="secondary">{podcastMinutes(episode)} min listen</Badge>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarClock size={13} />
                {new Date(publishedDate).toLocaleDateString()}
              </span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">{episode.title}</h1>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">{episode.summary}</p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <Metric label="Topic" value={episode.topic} />
              <Metric label="Audience" value={episode.audience} />
              <Metric label="Tone" value={episode.tone} />
            </div>

            <section className="mt-8 rounded-2xl border border-border bg-card/75 p-6">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles size={18} className="text-primary" />
                <h2 className="text-xl font-semibold">SEO briefing</h2>
              </div>
              <div className="space-y-5 text-sm leading-7 text-muted-foreground">
                {renderSeoContent(seoContent)}
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-border bg-secondary/35 p-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                <Radio size={15} />
                Episode notes
              </div>
              <div className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{episode.show_notes}</div>
            </section>

            <section className="mt-6 rounded-2xl border border-border bg-card/75 p-6">
              <h2 className="text-xl font-semibold">Podcast FAQ</h2>
              <div className="mt-4 space-y-3">
                {faqs.map((faq) => (
                  <details key={faq.question} className="rounded-xl border border-border bg-background/55 p-4">
                    <summary className="cursor-pointer font-medium">{faq.question}</summary>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </section>

            {episode.source_url && (
              <Button asChild variant="outline" className="mt-6">
                <Link href={episode.source_url}>
                  View source material
                  <ExternalLink size={15} />
                </Link>
              </Button>
            )}

            <section className="mt-6 rounded-2xl border border-border bg-card/75 p-6">
              <h2 className="text-xl font-semibold">Related resources</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Continue with practical AmroGen guides and official sender documentation that support this episode.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <ResourceLink href="/features/lead-generation" label="AmroGen lead generation" />
                <ResourceLink href="/features/ai-sequences" label="AI sequence generation" />
                <ResourceLink href="/features/multi-channel-outreach" label="Multi-channel outreach" />
                <ResourceLink href="/ai-sdr-tools" label="AI SDR tools guide" />
                <ResourceLink href="/developers" label="Developer API workflows" />
                <ResourceLink href="/pricing" label="AmroGen pricing" />
                <ResourceLink
                  href="https://support.google.com/mail/answer/81126?hl=en"
                  label="Google sender guidelines"
                  external
                />
                <ResourceLink
                  href="https://senders.yahooinc.com/best-practices/"
                  label="Yahoo sender best practices"
                  external
                />
                <ResourceLink
                  href="https://schema.org/PodcastEpisode"
                  label="PodcastEpisode schema"
                  external
                />
              </div>
            </section>
          </div>
        </div>
      </article>

      <MarketingFooter />
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/65 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 line-clamp-3 text-sm font-medium leading-5">{value}</p>
    </div>
  );
}

function ResourceLink({ href, label, external = false }: { href: string; label: string; external?: boolean }) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/55 px-4 py-3 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
    >
      {label}
      {external && <ExternalLink size={14} />}
    </Link>
  );
}

function absoluteAssetUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${siteUrl}${pathOrUrl}`;
}

function renderSeoContent(markdown: string) {
  return markdown
    .split(/\n{2,}/)
    .map((block, index) => {
      const text = block.trim();
      if (!text) return null;
      if (text.startsWith("### ")) {
        return <h3 key={index} className="text-lg font-semibold text-foreground">{text.replace(/^###\s+/, "")}</h3>;
      }
      if (text.startsWith("## ")) {
        return <h2 key={index} className="text-2xl font-semibold text-foreground">{text.replace(/^##\s+/, "")}</h2>;
      }
      if (text.includes("\n- ")) {
        const [intro, ...items] = text.split(/\n-\s+/);
        return (
          <div key={index}>
            {intro.trim() && <p>{intro.trim()}</p>}
            <ul className="mt-3 list-disc space-y-2 pl-5">
              {items.map((item) => <li key={item}>{item.trim()}</li>)}
            </ul>
          </div>
        );
      }
      return <p key={index}>{text}</p>;
    });
}

function fallbackSeoContent(episode: {
  topic: string;
  audience: string;
  summary: string;
  show_notes: string;
}) {
  return `## What this AmroGen Growth Brief covers

${episode.summary}

## Why this matters for B2B revenue teams

This episode is built for ${episode.audience}. It connects ${episode.topic} to practical AI SDR workflows, B2B lead generation, cold outreach quality, and sales automation decisions that affect pipeline outcomes.

## Key takeaways

${episode.show_notes}`;
}

function fallbackFaqs(episode: { topic: string; audience: string; duration_minutes: number }) {
  return [
    {
      question: "What is this AmroGen podcast episode about?",
      answer: `It covers ${episode.topic} for ${episode.audience}, with practical takeaways for AI SDR workflows and outbound execution.`,
    },
    {
      question: "Who should listen to this episode?",
      answer: "Founders, SDR leaders, revenue operators, agencies, and GTM teams evaluating AI-powered outbound should listen.",
    },
    {
      question: "How long is the episode?",
      answer: `The target listening time is about ${episode.duration_minutes} minutes.`,
    },
  ];
}
