import Link from "next/link";
import { BookOpen, Briefcase, Mail, MapPin, Phone, Video } from "lucide-react";
import AmroMeetBooking from "@/components/AmroMeetBooking";
import AmroMeetWidget from "@/components/AmroMeetWidget";
import { MarketingFooter, MarketingNav } from "@/components/MarketingPage";
import { BRAND, SUITE_PRODUCTS } from "@/lib/brand";
import {
  AMROGEN_DOC_SECTIONS,
  AMROGEN_TROUBLESHOOTING,
  AMROGEN_WALKTHROUGHS,
} from "@/lib/product-docs";
import { corePages } from "@/lib/marketing-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <MarketingNav />
      <main className="container mx-auto max-w-5xl px-4 py-16 sm:py-24">{children}</main>
      <MarketingFooter />
    </div>
  );
}

export function ContactPageContent() {
  return (
    <PageShell>
      <header className="mb-12 text-center">
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Contact AmroGen</h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Questions about B2B outreach, credits, Resend setup, or enterprise use? Reach the Agentic AI Ltd team directly.
        </p>
      </header>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <Card className="rounded-xl border border-border bg-card p-6">
            <div className="flex gap-4">
              <Mail className="mt-1 h-5 w-5 text-primary" />
              <div>
                <h2 className="font-semibold">Email</h2>
                <a href={`mailto:${BRAND.contactEmail}`} className="text-sm text-primary hover:underline">
                  {BRAND.contactEmail}
                </a>
                <p className="mt-2 text-sm text-muted-foreground">Best for product, billing, and support questions.</p>
              </div>
            </div>
          </Card>
          <Card className="rounded-xl border border-border bg-card p-6">
            <div className="flex gap-4">
              <Phone className="mt-1 h-5 w-5 text-primary" />
              <div>
                <h2 className="font-semibold">Phone</h2>
                <a href={`tel:${BRAND.phoneTel}`} className="text-sm text-primary hover:underline">
                  {BRAND.phone}
                </a>
              </div>
            </div>
          </Card>
          <Card className="rounded-xl border border-border bg-card p-6">
            <div className="flex gap-4">
              <MapPin className="mt-1 h-5 w-5 text-primary" />
              <div>
                <h2 className="font-semibold">Location</h2>
                <p className="text-sm text-muted-foreground">{BRAND.legalEntity}</p>
                <p className="text-sm text-muted-foreground">{BRAND.location}</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="rounded-xl border border-border bg-card p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Prefer a live conversation?</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Book a free consultation through AmroMeet to walk through your outbound workflow, credit usage, and whether
            AmroGen fits your team today.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Button asChild>
              <Link href="/consultation#book-demo">Book consultation</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/documentation">Read documentation</Link>
            </Button>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}

export function ConsultationPageContent() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <MarketingNav />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <header className="mb-10 text-center">
          <span className="marketing-eyebrow mb-4 inline-flex">Free consultation</span>
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Book a demo with AmroMeet</h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Schedule a practical session on whether AmroGen&apos;s coordinator-led, email-first MVP fits your outbound
            motion — live pipeline demo, Resend workflow, or enterprise API/MCP planning.
          </p>
        </header>

        <section className="mb-16 scroll-mt-24" id="book-demo">
          <AmroMeetWidget />
        </section>

        <AmroMeetBooking />
      </main>
      <MarketingFooter />
    </div>
  );
}

export function DocumentationPageContent() {
  return (
    <PageShell>
      <header className="mb-12">
        <Badge className="mb-4">Documentation</Badge>
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">AmroGen product documentation</h1>
        <p className="mt-4 max-w-3xl text-muted-foreground">
          Honest, MVP-accurate guides for operators and developers. We distinguish what ships today from roadmap items.
        </p>
      </header>

      <section className="mb-14 grid gap-5 md:grid-cols-2">
        {AMROGEN_DOC_SECTIONS.map((section) => (
          <Card key={section.id} id={section.id} className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{section.description}</p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {section.topics.map((topic) => (
                <li key={topic}>• {topic}</li>
              ))}
            </ul>
            <Button asChild variant="outline" size="sm" className="mt-5">
              <Link href={section.href}>Open guide</Link>
            </Button>
          </Card>
        ))}
      </section>

      <section className="mb-14">
        <div className="mb-6 flex items-center gap-2">
          <Video className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-semibold">Walkthroughs</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {AMROGEN_WALKTHROUGHS.map((guide) => (
            <Card key={guide.id} className="rounded-xl border border-border bg-card p-6">
              <div className="marketing-stat-label">{guide.duration}</div>
              <h3 className="mt-2 font-semibold">{guide.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{guide.description}</p>
              <ol className="mt-4 list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
                {guide.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <Button asChild variant="outline" size="sm" className="mt-5">
                <Link href={guide.href}>Start walkthrough</Link>
              </Button>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-6 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-semibold">Troubleshooting</h2>
        </div>
        <div className="space-y-4">
          {AMROGEN_TROUBLESHOOTING.map((item) => (
            <Card key={item.question} className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-semibold">{item.question}</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.answer}</p>
            </Card>
          ))}
        </div>
      </section>
    </PageShell>
  );
}

export function DocumentationPricingPageContent() {
  const page = corePages.pricing;
  return (
    <PageShell>
      <header className="mb-10">
        <Badge variant="secondary" className="mb-4">Documentation</Badge>
        <h1 className="text-3xl font-bold text-foreground">Credits and pricing</h1>
        <p className="mt-4 max-w-3xl text-muted-foreground">
          AmroGen uses Stripe credit packs — not ranking guarantees or inflated ROI claims. One pipeline run covers lead
          discovery, reviewed email sequences, and Resend-ready outreach preparation.
        </p>
      </header>
      <Card className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          See the live pricing page for current plan amounts, credit counts, and pay-as-you-go rates.
        </p>
        <Button asChild className="mt-5">
          <Link href="/pricing">{page.h1}</Link>
        </Button>
      </Card>
    </PageShell>
  );
}

export function PrivacyPolicyPageContent() {
  return (
    <PageShell>
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Privacy Policy</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: July 2026</p>
      </header>
      <Card className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <div className="space-y-8 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">1. Introduction</h2>
            <p>
              {BRAND.legalEntity} (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates {BRAND.productName}. This policy
              explains how we collect, use, and safeguard information when you use the service.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">2. Information we collect</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Account details such as name, email, and authentication data (JWT sessions)</li>
              <li>Billing information processed by Stripe — we do not store full card numbers</li>
              <li>Campaign inputs such as target company URLs, lead data, and generated sequences</li>
              <li>Resend configuration metadata needed to send approved email steps</li>
              <li>Usage, diagnostics, and support communications</li>
            </ul>
          </section>
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">3. How we use information</h2>
            <p>
              We use data to operate campaigns, authenticate users, process credit purchases, improve product reliability,
              and respond to support requests. We do not sell personal data.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">4. Third-party processors</h2>
            <p>
              We use service providers including Stripe (payments), Resend (email delivery), cloud hosting, and AI model
              providers required to run the coordinator pipeline. Each processor is used only for its operational purpose.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">5. Contact</h2>
            <p>
              Privacy questions:{" "}
              <a href={`mailto:${BRAND.contactEmail}`} className="text-primary hover:underline">
                {BRAND.contactEmail}
              </a>
            </p>
          </section>
        </div>
      </Card>
    </PageShell>
  );
}

export function TermsPageContent() {
  return (
    <PageShell>
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Terms and Conditions</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: July 2026</p>
      </header>
      <Card className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <div className="space-y-8 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">1. Service description</h2>
            <p>
              {BRAND.productName} provides B2B outreach tooling including URL-based lead research, reviewed email sequence
              generation, and Resend-based sending after human approval. Feature availability may change; roadmap items are
              not guaranteed delivery dates.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">2. Accounts and credits</h2>
            <p>
              You are responsible for safeguarding your account credentials and API keys. Credits are consumed by pipeline
              runs and related usage as described on the pricing page. Stripe handles payment processing.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">3. Acceptable use</h2>
            <p>
              You must comply with applicable laws, anti-spam regulations, and recipient consent requirements. You are
              responsible for the outreach you approve and send through connected sending accounts.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">4. No guaranteed outcomes</h2>
            <p>
              We do not guarantee meetings, replies, revenue, or deliverability results. {BRAND.productName} automates
              research and copy preparation — not commercial outcomes.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">5. Contact</h2>
            <p>
              Legal or billing questions:{" "}
              <a href={`mailto:${BRAND.contactEmail}`} className="text-primary hover:underline">
                {BRAND.contactEmail}
              </a>
            </p>
          </section>
        </div>
      </Card>
    </PageShell>
  );
}

export function CareersPageContent() {
  return (
    <PageShell>
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Careers at Agentic AI Ltd</h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          We build practical AI products — including {BRAND.productName} — with enterprise-grade engineering discipline.
        </p>
      </header>
      <Card className="rounded-xl border border-border bg-card p-6 sm:p-8 text-center">
        <Briefcase className="mx-auto h-8 w-8 text-primary" />
        <h2 className="mt-4 text-xl font-semibold">No open roles listed right now</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          We are not posting fabricated openings. If you would like to introduce yourself for future roles across the Amro
          product suite, email us with your background and interests.
        </p>
        <Button asChild className="mt-6">
          <a href={`mailto:${BRAND.helloEmail}?subject=Careers%20-%20Agentic%20AI%20Ltd`}>Email {BRAND.helloEmail}</a>
        </Button>
      </Card>
      <div className="mt-10">
        <h2 className="mb-4 text-lg font-semibold">Other Amro products</h2>
        <div className="flex flex-wrap gap-3">
          {SUITE_PRODUCTS.map((product) => (
            <Button key={product.label} asChild variant="outline" size="sm">
              <a href={product.href} target="_blank" rel="noopener noreferrer">
                {product.label}
              </a>
            </Button>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
