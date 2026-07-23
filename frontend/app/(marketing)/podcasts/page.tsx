import type { Metadata } from "next";
import type { ReactNode } from "react";
import { FAQAccordionBlock } from "@/components/ui/faq-accordion-block-shadcnui";
import Link from "next/link";
import { CalendarClock, Headphones, Mail, Network, Radio, Sparkles, Target } from "lucide-react";
import { JsonLd, MarketingFooter, MarketingNav } from "@/components/MarketingPage";
import PodcastAudioPlayer from "@/components/PodcastAudioPlayer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getPublicPodcastArchive,
  podcastAudioUrl,
  podcastCoverImagePath,
  podcastEpisodePath,
  podcastMinutes,
  podcastPublicUrl,
} from "@/lib/podcasts";
import { siteUrl } from "@/lib/marketing-content";

export const dynamic = "force-dynamic";

const title = "AmroGen Growth Brief Podcast - AI SDR, B2B Lead Generation & Cold Outreach";
const description =
  "Listen to AmroGen Growth Brief episodes on AI SDR tools, B2B lead generation, personalized cold email, multi-channel outreach, and product updates for modern revenue teams.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "AI SDR podcast",
    "B2B lead generation podcast",
    "cold email podcast",
    "sales automation podcast",
    "multi-channel outreach",
    "agentic AI sales",
    "revenue operations podcast",
  ],
  alternates: { canonical: "/podcasts" },
  openGraph: {
    title,
    description,
    url: `${siteUrl}/podcasts`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

const podcastFaqs = [
  {
    question: "What does the AmroGen Growth Brief podcast cover?",
    answer:
      "Episodes cover AI SDR workflows, B2B prospecting, lead research, personalized cold email, multi-channel outreach, sales automation, deliverability, and practical go-to-market decisions.",
  },
  {
    question: "Who is this B2B sales podcast for?",
    answer:
      "It is designed for founders, SDR and sales leaders, revenue operators, agencies, and GTM teams evaluating how AI can improve targeted outbound without sacrificing quality control.",
  },
  {
    question: "How long are the episodes?",
    answer:
      "The Growth Brief uses concise episodes built for working operators. Each episode card shows its approximate listening time before playback.",
  },
  {
    question: "Can I read the source material instead?",
    answer:
      "Yes. Many episodes connect to AmroGen's in-depth articles, and the podcast archive links to the broader blog for readers who want detailed comparisons and implementation guidance.",
  },
];

export default async function PodcastsPage() {
  const { episodes, error: podcastFetchError } = await getPublicPodcastArchive(24);
  const featured = episodes[0];

  return (
    <main className="min-h-screen overflow-hidden bg-background">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "PodcastSeries",
          name: "AmroGen Growth Brief",
          url: `${siteUrl}/podcasts`,
          description,
          publisher: {
            "@type": "Organization",
            name: "AmroGen",
            url: siteUrl,
          },
          hasPart: episodes.map((episode) => ({
            "@type": "PodcastEpisode",
            name: episode.title,
            description: episode.summary,
            datePublished: episode.published_at || episode.created_at,
            duration: `PT${Math.max(1, podcastMinutes(episode))}M`,
            url: podcastPublicUrl(episode),
            associatedMedia: episode.audio_url
              ? {
                  "@type": "MediaObject",
                  contentUrl: podcastAudioUrl(episode),
                  encodingFormat: episode.audio_mime_type || "audio/mpeg",
                }
              : undefined,
          })),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "AmroGen Growth Brief podcast episodes",
          itemListElement: episodes.map((episode, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: podcastPublicUrl(episode),
            name: episode.title,
          })),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: podcastFaqs.map((faq) => ({
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
      <div className="absolute inset-x-0 top-0 -z-10 h-[460px] bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_62%)]" />
      <MarketingNav />

      <section className="mx-auto max-w-6xl px-6 pb-12 pt-16 lg:pb-16 lg:pt-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <Badge className="mb-6">AmroGen Growth Brief</Badge>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              AI sales strategy, product updates, and outreach lessons in podcast form.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
              A concise podcast archive for founders, SDR leaders, agencies, and GTM operators who want sharper lead generation, better cold email, and practical AI SDR workflows.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href={featured ? podcastEpisodePath(featured) : "/blog"}>
                  Listen now
                  <Headphones size={18} />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/blog">Read the blog</Link>
              </Button>
            </div>
          </div>

          <div>
            {featured ? (
              <Link href={podcastEpisodePath(featured)} className="block">
                <img
                  src={podcastCoverImagePath(featured)}
                  alt={`${featured.title} podcast cover`}
                  className="min-h-[390px] w-full rounded-2xl border border-primary/25 object-cover shadow-2xl"
                />
              </Link>
            ) : (
              <PodcastCover
                title="AI sales intelligence for modern revenue teams"
                topic="AmroGen Growth Brief"
                index={0}
                featured
              />
            )}
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Metric label="Episodes" value={String(episodes.length)} />
              <Metric label="Focus" value="AI SDR" />
              <Metric label="Format" value="Briefs" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-2xl border border-border bg-card/65 p-6 md:p-9">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Practical revenue intelligence</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              A B2B sales podcast about the decisions behind effective AI-powered outbound.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              AmroGen Growth Brief goes beyond automation headlines. Episodes examine how teams find the right
              decision-makers, turn account research into relevant messaging, protect deliverability, coordinate
              email and multi-channel outreach, and evaluate AI SDR platforms against pipeline outcomes.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <TopicCard icon={<Target size={19} />} title="Lead generation strategy">
              Research-first prospecting, ICP decisions, account signals, enrichment, and verified contact discovery.
            </TopicCard>
            <TopicCard icon={<Mail size={19} />} title="Cold email quality">
              Personalization, message relevance, Gmail-native sending, deliverability, and human review loops.
            </TopicCard>
            <TopicCard icon={<Network size={19} />} title="AI SDR operations">
              Agentic workflows, multi-channel sequencing, sales automation, governance, and practical tool selection.
            </TopicCard>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        {episodes.length === 0 ? (
          <div className="rounded-lg border border-border bg-card/75 p-10 text-center">
            <Radio size={34} className="mx-auto text-primary" />
            <h2 className="mt-4 text-xl font-semibold">
              {podcastFetchError ? "Podcast feed is temporarily unavailable" : "No public episodes yet"}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {podcastFetchError
                ? `${podcastFetchError} Make sure the backend is running on the API URL configured for the frontend.`
                : "Published AmroGen podcast episodes will appear here automatically after an admin approves them in Podcast Studio."}
            </p>
          </div>
        ) : (
          <div className="grid gap-5">
            {episodes.map((episode, index) => (
              <article
                id={episode.id}
                key={episode.id}
                className="rounded-2xl border border-border bg-card/75 p-5 md:p-7 transition-colors hover:border-primary/30"
              >
                <div className="grid gap-6 md:grid-cols-[190px_1fr] xl:grid-cols-[220px_1fr_340px] xl:items-start">
                  <Link href={podcastEpisodePath(episode)} className="block group">
                    <img
                      src={podcastCoverImagePath(episode)}
                      alt={`${episode.title} podcast cover`}
                      className="aspect-square w-full rounded-2xl border border-primary/25 object-cover shadow-xl transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </Link>
                  <div>
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <Badge variant={index === 0 ? "default" : "secondary"}>
                        {index === 0 ? "Latest episode" : "Episode"}
                      </Badge>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarClock size={12} />
                        {new Date(episode.published_at || episode.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{podcastMinutes(episode)} min</span>
                    </div>
                    <h2 className="text-2xl font-semibold tracking-tight">
                      <Link href={podcastEpisodePath(episode)} className="hover:text-primary transition-colors">
                        {episode.title}
                      </Link>
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{episode.summary}</p>
                    {episode.show_notes && (
                      <div className="mt-5 rounded-xl border border-border bg-secondary/35 p-4 text-sm leading-6 text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                        {episode.show_notes}
                      </div>
                    )}
                  </div>
                  <div className="rounded-2xl border border-border bg-background/70 p-4 md:col-span-2 xl:col-span-1">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                      <Sparkles size={16} className="text-primary" />
                      Listen to this brief
                    </div>
                    {episode.audio_url ? (
                      <PodcastAudioPlayer
                        src={podcastAudioUrl(episode)}
                        cover={podcastCoverImagePath(episode)}
                        title={episode.title}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">Audio is being prepared.</p>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <FAQAccordionBlock
        faqs={podcastFaqs}
        heading="About the AmroGen Growth Brief"
        subheading="A concise audio companion to AmroGen's research on AI sales development, outbound strategy, and practical revenue-team workflows."
      />

      <MarketingFooter />
    </main>
  );
}

function PodcastCover({
  title,
  topic,
  index,
  featured = false,
}: {
  title: string;
  topic: string;
  index: number;
  featured?: boolean;
}) {
  const bars = [24, 42, 68, 36, 76, 52, 88, 44, 70, 32, 62, 48];
  return (
    <div
      className={`relative isolate overflow-hidden rounded-2xl border border-primary/25 bg-[#0B1118] p-5 text-white shadow-2xl ${featured ? "min-h-[390px]" : "aspect-square min-h-[190px]"}`}
    >
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_15%_15%,rgba(34,211,197,0.32),transparent_38%),radial-gradient(circle_at_90%_75%,rgba(56,189,248,0.26),transparent_42%),linear-gradient(145deg,#0B1118_15%,#111A24_70%,#071016)]" />
      <div className="absolute inset-0 -z-10 opacity-30 [background-image:linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-[#22D3C5]">
        <span>AmroGen</span>
        <span>Growth Brief · {String(index + 1).padStart(2, "0")}</span>
      </div>
      <div className="mt-6 flex items-end gap-1">
        {bars.map((height, barIndex) => (
          <span
            key={barIndex}
            className="w-full rounded-full bg-gradient-to-t from-[#22D3C5] to-[#38BDF8]"
            style={{ height: Math.max(12, height * (featured ? 0.72 : 0.42)) }}
          />
        ))}
      </div>
      <div className={featured ? "mt-8" : "mt-5"}>
        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">{topic}</p>
        <p className={`mt-2 font-bold leading-tight ${featured ? "text-3xl" : "line-clamp-4 text-lg"}`}>{title}</p>
      </div>
      <div className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-[#22D3C5]/40 bg-[#22D3C5]/10 text-[#22D3C5]">
        <Radio size={18} />
      </div>
    </div>
  );
}

function TopicCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background/55 p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{children}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/70 px-3 py-3">
      <div className="text-sm font-semibold">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
    </div>
  );
}
