import type { ReactNode } from "react";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, BookOpen, CheckCircle2, ExternalLink } from "lucide-react";
import AmroMeetWidget from "@/components/AmroMeetWidget";
import HomepageIntroVideo from "@/components/HomepageIntroVideo";
import HomepageProductScreenshots from "@/components/HomepageProductScreenshots";
import Logo from "@/components/Logo";
import { MarketingNav } from "@/components/MarketingNav";
import { ProcessFlowDiagram } from "@/components/process-flow/ProcessFlowDiagram";
import PodcastHomeSection from "@/components/PodcastHomeSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AMROGEN_DEVELOPER_FLOW, AMROGEN_OUTREACH_FLOW, AMROGEN_PRODUCT_WORKFLOW } from "@/content/landing-process-flows";
import { getAllPosts } from "@/lib/blog";
import { BRAND, SUITE_PRODUCTS } from "@/lib/brand";
import type { HomepageFaqItem, MarketingPageContent } from "@/lib/marketing-content";
import { homepageFaq, homepageInputModes, howItWorksFaq } from "@/lib/marketing-content";
import { APPROX_PAYG_RUN_GBP, formatPlanPrice } from "@/lib/pricing-plans";

export { MarketingNav } from "@/components/MarketingNav";

const footerGroups = [
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Careers", href: "/careers" },
      { label: "Consultation", href: "/consultation" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "/documentation" },
      { label: "How it works", href: "/how-it-works" },
      { label: "Blog", href: "/blog" },
      { label: "Podcasts", href: "/podcasts" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Features",
    links: [
      { label: "Lead generation", href: "/features/lead-generation" },
      { label: "AI sequences", href: "/features/ai-sequences" },
      { label: "Email outreach", href: "/features/email-outreach" },
      { label: "Developers", href: "/developers" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy-policy" },
      { label: "Terms & Conditions", href: "/terms-and-conditions" },
      { label: "Research hub", href: "/ai-sdr-tools" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-secondary/45">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[1.1fr_2fr]">
        <div>
          <Link href="/" aria-label="AmroGen home">
            <Logo showText={false} size="lg" />
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
            AI sales agent for B2B outreach: company URL campaigns ship today; manual entry and document upload on the roadmap.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild size="sm">
              <Link href="/sign-up">Start campaign</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/pricing">View pricing</Link>
            </Button>
          </div>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {footerGroups.map((group) => (
            <div key={group.title}>
              <h2 className="text-sm font-semibold">{group.title}</h2>
              <div className="mt-4 space-y-3">
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-border/70">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <p className="marketing-section-label">Amro product suite</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {SUITE_PRODUCTS.map((product) => (
              <a
                key={product.label}
                href={product.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                {product.label}
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} {BRAND.productName}. {BRAND.legalEntity}.</span>
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy-policy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms-and-conditions" className="hover:text-foreground">Terms</Link>
            <Link href="/documentation" className="hover:text-foreground">Docs</Link>
            <Link href="/sign-in" className="hover:text-foreground">Sign in</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

const alternativeVisuals: Record<string, {
  competitor: string;
  domain: string;
  bestFor: string;
  officialLinks: { label: string; href: string }[];
}> = {
  "/alternatives/apollo-alternative": {
    competitor: "Apollo.io",
    domain: "apollo.io",
    bestFor: "large database prospecting",
    officialLinks: [
      { label: "Apollo website", href: "https://www.apollo.io" },
      { label: "Apollo pricing", href: "https://www.apollo.io/pricing" },
    ],
  },
  "/alternatives/clay-alternative": {
    competitor: "Clay",
    domain: "clay.com",
    bestFor: "custom enrichment tables",
    officialLinks: [
      { label: "Clay website", href: "https://www.clay.com" },
      { label: "Clay pricing", href: "https://www.clay.com/pricing" },
    ],
  },
  "/alternatives/instantly-alternative": {
    competitor: "Instantly",
    domain: "instantly.ai",
    bestFor: "cold email sending infrastructure",
    officialLinks: [
      { label: "Instantly website", href: "https://instantly.ai" },
      { label: "Instantly pricing", href: "https://instantly.ai/pricing" },
    ],
  },
  "/alternatives/lemlist-alternative": {
    competitor: "Lemlist",
    domain: "lemlist.com",
    bestFor: "creative sequence building",
    officialLinks: [
      { label: "Lemlist website", href: "https://www.lemlist.com" },
      { label: "Lemlist pricing", href: "https://www.lemlist.com/pricing" },
    ],
  },
};

function HonestTrustStrip() {
  const items = [
    "URL, manual, or CSV input",
    "Human approval before send",
    "Email-first via Resend",
    `From about ${formatPlanPrice(APPROX_PAYG_RUN_GBP)} per run`,
  ];
  return <p className="marketing-meta-line mt-8">{items.join(" · ")}</p>;
}

function InputModesSection() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-16" aria-labelledby="input-modes-heading">
      <div className="max-w-3xl">
        <span className="marketing-eyebrow mb-4 inline-flex">Campaign input</span>
        <h2 id="input-modes-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Three ways to feed an AI sales agent
        </h2>
        <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
          AmroGen accepts a company URL, manually entered contacts, or a CSV document. URL mode researches the account
          and discovers leads. Manual and CSV modes skip discovery and move straight to personalised sequence writing,
          review, and Resend sending.
        </p>
      </div>
      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {homepageInputModes.map((mode) => {
          const Icon = mode.icon;
          const isLive = mode.status === "live";
          return (
            <div
              key={mode.id}
              className="flex flex-col rounded-xl border border-border bg-card/75 p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                  <Icon size={20} className="text-primary" />
                </div>
                <Badge variant={isLive ? "default" : "secondary"}>{mode.statusLabel}</Badge>
              </div>
              <h3 className="mt-5 text-lg font-semibold">{mode.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{mode.body}</p>
              <p className="mt-4 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Example: </span>
                {mode.example}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/how-it-works" className="font-medium text-primary hover:underline">
          See the full workflow
        </Link>
        {" · "}
        <Link href="/documentation" className="font-medium text-primary hover:underline">
          Read product documentation
        </Link>
      </p>
    </section>
  );
}

function MarketingFaqSection({
  faq,
  title = "AI sales agent questions, answered honestly",
  description = "Clear answers about what AmroGen does today, how campaigns work, what is still on the roadmap, and how it compares to databases and senders like Apollo, Clay, and Instantly.",
}: {
  faq: HomepageFaqItem[];
  title?: string;
  description?: string;
}) {
  return (
    <section className="border-t border-border/70 bg-secondary/25" aria-labelledby="faq-heading">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-3xl">
          <span className="marketing-eyebrow mb-4 inline-flex">FAQ</span>
          <h2 id="faq-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">{description}</p>
        </div>
        <div className="mt-10 divide-y divide-border rounded-xl border border-border bg-card/75">
          {faq.map((item) => (
            <details key={item.question} className="group px-5 py-4 sm:px-6">
              <summary className="cursor-pointer list-none text-sm font-semibold leading-6 text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                {item.question}
              </summary>
              <p className="mt-3 pb-2 text-sm leading-7 text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function HomepageFaqSection() {
  return <MarketingFaqSection faq={homepageFaq} />;
}

function ProductShowcase() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-8">
      <div className="rounded-xl border border-border bg-card/75 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Real workflow, not slide-deck promises</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          AmroGen starts from a company URL, returns verified decision-makers, and prepares reviewed email sequences
          you approve before anything sends. Tap or click any step to expand.
        </p>
        <div className="mt-5">
          <ProcessFlowDiagram flow={AMROGEN_OUTREACH_FLOW} testId="amrogen-home-workflow" />
        </div>
      </div>
    </section>
  );
}

function ProductWorkflowVisual({ page }: { page: MarketingPageContent }) {
  const isHowItWorks = page.slug === "/how-it-works";
  const flow =
    page.slug === "/developers"
      ? AMROGEN_DEVELOPER_FLOW
      : isHowItWorks
        ? AMROGEN_PRODUCT_WORKFLOW
        : AMROGEN_OUTREACH_FLOW;

  return (
    <section className="mx-auto max-w-6xl px-6 pb-8">
      <div className="rounded-xl border border-border bg-card/75 p-5 sm:p-6">
        {isHowItWorks && (
          <>
            <h2 className="text-lg font-semibold">The coordinator-led pipeline</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              AmroGen compresses research, personalisation, quality review, and Resend delivery into one run you can
              inspect at every step. Tap or click any stage to expand.
            </p>
          </>
        )}
        <div className={isHowItWorks ? "mt-5" : undefined}>
          <ProcessFlowDiagram flow={flow} testId={`workflow-${page.slug.replace(/\//g, "") || "home"}`} />
        </div>
      </div>
    </section>
  );
}

function AlternativeComparisonVisual({ page }: { page: MarketingPageContent }) {
  const visual = alternativeVisuals[page.slug];
  if (!visual) return <ProductWorkflowVisual page={page} />;

  return (
    <section className="mx-auto max-w-6xl px-6 pb-10">
      <div className="rounded-lg border border-border bg-card/75 p-5 md:p-6">
        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="rounded-lg border border-border bg-background/70 p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-border bg-white p-2">
                  <img
                    src="/assets/images/logo/amrogen_light_logo.png"
                    alt="AmroGen logo"
                    className="h-full w-full object-contain"
                    loading="lazy"
                  />
                </div>
                <div>
                  <div className="text-lg font-semibold">AmroGen</div>
                  <p className="text-sm text-muted-foreground">Research, copy, review, and Resend sending.</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-sm font-bold text-primary">
                vs
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background/70 p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-border bg-white p-3">
                  <img
                    src={`https://logo.clearbit.com/${visual.domain}`}
                    alt={`${visual.competitor} logo`}
                    className="h-full w-full object-contain"
                    loading="lazy"
                  />
                </div>
                <div>
                  <div className="text-lg font-semibold">{visual.competitor}</div>
                  <p className="text-sm text-muted-foreground">Strongest for {visual.bestFor}.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-secondary/50 p-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ExternalLink size={16} className="text-primary" />
              Official source links
            </div>
            <div className="mt-4 space-y-3">
              {visual.officialLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/65 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                  <ExternalLink size={14} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function blogFeatureImage(post: { images: { src: string; alt: string }[]; fileName: string; title: string }) {
  if (post.images[0]) return post.images[0];
  const base = post.fileName.replace(/\.md$/, "");
  return { src: `/blog-assets/${base}-feature.png`, alt: post.title };
}

function HomepageBlogPreview() {
  const posts = getAllPosts().slice(-3).reverse();
  if (!posts.length) return null;

  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="secondary" className="mb-4">Latest resources</Badge>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Research-backed guides from the AmroGen blog.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Long-form SEO articles covering AI SDR tools, B2B prospecting, cold email, and personalization.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/blog">
            View blog
            <BookOpen size={16} />
          </Link>
        </Button>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {posts.map((post) => {
          const img = blogFeatureImage(post);
          return (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group overflow-hidden rounded-lg border border-border bg-card/75 transition-colors hover:border-primary/50"
            >
              <div className="overflow-hidden">
                <img
                  src={img.src}
                  alt={img.alt}
                  className="aspect-[16/9] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  loading="lazy"
                />
              </div>
              <div className="p-5">
                <div className="marketing-stat-label">{post.primaryKeyword}</div>
                <h3 className="mt-3 text-base font-semibold leading-snug">{post.title}</h3>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{post.excerpt}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function MarketingPage({ page, bottomSection }: { page: MarketingPageContent; bottomSection?: ReactNode }) {
  const isHomepage = page.slug === "/";
  const isHowItWorks = page.slug === "/how-it-works";
  const showInputModes = isHomepage || isHowItWorks;

  return (
    <main className="min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,hsl(var(--background)),hsl(var(--secondary)))]" />
      <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_62%)]" />

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-16 lg:pb-24 lg:pt-24">
        <MarketingNav />
        <div className="max-w-4xl">
          <span className="marketing-eyebrow mb-6">{page.eyebrow}</span>
          <h1 className="heading-safe max-w-5xl text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {page.h1}
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            {page.subheadline}
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            {page.primaryCta && (
              <Button asChild size="lg">
                <Link href={page.primaryCta.href}>
                  {page.primaryCta.label}
                  <ArrowRight size={18} />
                </Link>
              </Button>
            )}
            {page.secondaryCta && (
              <Button asChild variant="outline" size="lg">
                <Link href={page.secondaryCta.href}>{page.secondaryCta.label}</Link>
              </Button>
            )}
          </div>
          {isHomepage && <HonestTrustStrip />}
        </div>

        {page.stats && (
          <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {page.stats.map((stat) => (
              <div key={stat.label} className="rounded-lg border border-border bg-card/70 p-5">
                <div className="text-3xl font-bold text-primary">{stat.value}</div>
                <div className="marketing-stat-label mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {isHomepage && <HomepageIntroVideo />}
      {isHowItWorks && <HomepageIntroVideo />}
      {showInputModes && <InputModesSection />}
      {isHomepage && <HomepageProductScreenshots />}
      {isHomepage && <ProductShowcase />}

      <AlternativeComparisonVisual page={page} />

      <section className="mx-auto max-w-6xl space-y-16 px-6 pb-24">
        {page.sections.map((section) => (
          <div key={section.title} className="border-t border-border/70 pt-12">
            {section.eyebrow && <span className="marketing-eyebrow mb-4 inline-flex">{section.eyebrow}</span>}
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{section.title}</h2>
                {section.body && <p className="mt-4 leading-7 text-muted-foreground">{section.body}</p>}
              </div>
              <div className="space-y-4">
                {section.items && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {section.items.map(({ title, body, icon: Icon }) => (
                      <div key={title} className="rounded-lg border border-border bg-card/70 p-5">
                        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                          {Icon ? <Icon size={20} className="text-primary" /> : <CheckCircle2 size={20} className="text-primary" />}
                        </div>
                        <h3 className="font-semibold">{title}</h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
                      </div>
                    ))}
                  </div>
                )}
                {section.table && (
                  <div className="overflow-hidden rounded-lg border border-border bg-card/70">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="bg-secondary/70 text-xs font-medium leading-normal text-muted-foreground">
                        <tr>
                          {section.table.columns.map((column) => (
                            <th key={column} className="px-4 py-3 font-medium">{column}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {section.table.rows.map((row) => (
                          <tr key={row.join("|")}>
                            {row.map((cell) => (
                              <td key={cell} className="px-4 py-4 text-muted-foreground first:text-foreground">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </section>

      {isHomepage && (
        <Suspense fallback={null}>
          <PodcastHomeSection />
        </Suspense>
      )}
      {isHomepage && <HomepageBlogPreview />}
      {isHomepage && (
        <section className="border-t border-border/70 bg-gradient-to-br from-background via-background to-primary/5 py-16 sm:py-20" id="book-demo">
          <AmroMeetWidget />
          <div className="mx-auto mt-8 max-w-6xl px-6 text-center">
            <Button asChild variant="outline">
              <Link href="/consultation#book-demo">
                Request a tailored demo session
                <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
        </section>
      )}
      {isHomepage && <HomepageFaqSection />}
      {isHowItWorks && (
        <MarketingFaqSection
          faq={howItWorksFaq}
          title="How the pipeline works, answered honestly"
          description="Clear answers about coordinator runs, input modes, quality review, approval, and integrations — without slide-deck promises."
        />
      )}

      {bottomSection}

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 rounded-lg border border-border bg-card/75 p-6 md:grid-cols-[1.4fr_0.6fr] md:items-center md:p-8">
          <div>
            <Badge variant="secondary" className="mb-4">Ready when you are</Badge>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {isHowItWorks
                ? "Start with account context — reviewed outreach today."
                : "Start with a company URL — reviewed outreach today."}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {isHowItWorks
                ? "Bring a URL, contacts, or an import. Inspect every lead and message, then approve what deserves to go out."
                : "Paste a target account, inspect every lead and message, then approve what deserves to go out. Manual entry and document upload are coming next."}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:justify-end">
            <Button asChild>
              <Link href="/sign-up">
                Start
                <ArrowRight size={16} />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/pricing">Pricing</Link>
            </Button>
          </div>
        </div>
      </section>
      <MarketingFooter />
    </main>
  );
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
