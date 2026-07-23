import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Code2, Mail, MessageSquareText } from "lucide-react";
import { JsonLd, MarketingFooter, MarketingNav } from "@/components/MarketingPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PricingTable } from "@/components/blocks/pricing-table";
import { FAQAccordionBlock } from "@/components/ui/faq-accordion-block-shadcnui";
import { siteUrl } from "@/lib/marketing-content";
import {
  formatPlanPrice,
  PAYG_CREDIT_PRICE_GBP,
  PRICING_CURRENCY,
  SUBSCRIPTION_PLANS,
} from "@/lib/pricing-plans";

export const metadata: Metadata = {
  title: "AmroGen Pricing - from £599 per campaign",
  description:
    "Campaign pricing: Starter £599/campaign, Professional £2,999/campaign, Enterprise £4,999/campaign. Save 10–20% on 10-campaign packs.",
  alternates: { canonical: "/pricing" },
};

const PLANS = SUBSCRIPTION_PLANS.map(
  ({
    name,
    level,
    pricePerCampaign,
    packCampaignCount,
    packListPrice,
    packDiscountPercent,
    packPrice,
    popular,
  }) => ({
    name,
    level,
    pricePerCampaign,
    packCampaignCount,
    packListPrice,
    packDiscountPercent,
    packPrice,
    popular,
  }),
);

const FEATURES = [
  { name: "Lead discovery from company URL", included: "starter" },
  { name: "AI email sequence copy", included: "starter" },
  { name: "Human review before sending", included: "starter" },
  { name: "Gmail-native sending", included: "starter" },
  { name: "ICP fit scoring per lead", included: "starter" },
  { name: "LinkedIn + SMS outreach copy", included: "pro" },
  { name: "REST API access", included: "pro" },
  { name: "MCP server integration", included: "pro" },
  { name: "Priority support + SLA", included: null },
  { name: "Custom integrations", included: null },
];

const PRICING_FAQS = [
  {
    question: "What is a pipeline run?",
    answer:
      "One pipeline run covers the full AmroGen workflow: scraping the company URL, finding decision-makers, scoring ICP fit, generating personalised sequences for each lead, and routing everything to your review inbox. A single run typically processes 8–12 leads end to end.",
  },
  {
    question: "How do credits work?",
    answer:
      `Each campaign uses about 8 credits. Plans are priced per campaign (Starter ${formatPlanPrice(599)}, Professional ${formatPlanPrice(2999)}, Enterprise ${formatPlanPrice(4999)}). Buy a 10-campaign pack to get 10–20% off. You can also top up with pay-as-you-go credits at ${formatPlanPrice(PAYG_CREDIT_PRICE_GBP)}/credit.`,
  },
  {
    question: "Can I see AmroGen before committing?",
    answer:
      "Yes — book a demo with our team and we'll walk you through a live pipeline run on a real company URL so you can see exactly what the research, sequences, and review workflow looks like before subscribing.",
  },
  {
    question: "Is pricing per seat?",
    answer:
      "No. AmroGen is credits-based, not per-seat. Your whole team can access the same workspace without paying extra for each user. You only pay for the outreach you run.",
  },
  {
    question: "What happens if I exceed my credits?",
    answer:
      "We will notify you before you hit your limit. You can top up with pay-as-you-go credits at any time, or upgrade to a higher plan mid-cycle — proration is applied automatically.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. Cancel anytime from your account settings. Your plan stays active until the end of the billing period — there are no cancellation fees and no minimum commitment.",
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-background overflow-hidden">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "AmroGen",
          url: `${siteUrl}/pricing`,
          offers: SUBSCRIPTION_PLANS.map((plan) => ({
            "@type": "Offer",
            name: plan.name,
            price: String(plan.pricePerCampaign),
            priceCurrency: PRICING_CURRENCY,
            description: `${formatPlanPrice(plan.pricePerCampaign)}/campaign · 10-pack ${formatPlanPrice(plan.packPrice)} (${plan.packDiscountPercent}% off)`,
          })),
        }}
      />

      <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.14),transparent_60%)]" />
      <MarketingNav />

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-16 pb-4 text-center">
        <Badge className="mb-6">Per campaign</Badge>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          £599–£4,999 per campaign.{" "}
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Save on 10-packs.
          </span>
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-2xl mx-auto">
          One campaign covers lead discovery, personalised sequences, quality review, and outreach. Buy 10 campaigns and get 10–20% off.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row justify-center">
          <Button asChild size="lg">
            <Link href="/sign-up">
              Get started
              <ArrowRight size={16} />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/consultation#book-demo">Book a demo</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/campaigns/new">Launch a campaign</Link>
          </Button>
        </div>
      </section>

      {/* Pricing Table */}
      <PricingTable
        plans={PLANS}
        features={FEATURES}
        defaultPlan="pro"
      />

      {/* What's included */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-4">Every plan includes</Badge>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            The full workflow, from URL to sent email.
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              icon: Mail,
              title: "Lead discovery",
              body: "Find verified decision-makers — name, title, LinkedIn, and direct email — from any company domain.",
            },
            {
              icon: MessageSquareText,
              title: "Multi-channel sequences",
              body: "Generate personalised email, LinkedIn, and SMS copy in one run. Each message references real account context.",
            },
            {
              icon: Code2,
              title: "API and MCP access",
              body: "Use AmroGen from your own tools and AI workflows via REST API or the MCP server. Available on Growth and Scale.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card/70 p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                <Icon size={20} className="text-primary" />
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <FAQAccordionBlock
        faqs={PRICING_FAQS}
        heading="Pricing questions answered"
        subheading="Everything you need to know before starting your first campaign."
      />

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 rounded-lg border border-border bg-card/75 p-6 md:grid-cols-[1.4fr_0.6fr] md:items-center md:p-8">
          <div>
            <Badge variant="secondary" className="mb-4">Ready when you are</Badge>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Turn a target account into reviewed outreach today.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Start with one company URL, inspect every lead and message, then decide what deserves to go out.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:justify-end">
            <Button asChild>
              <Link href="/sign-up">
                Get started
                <ArrowRight size={16} />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/about">About AmroGen</Link>
            </Button>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
