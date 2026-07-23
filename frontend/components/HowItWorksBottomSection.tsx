import Link from "next/link";
import { BookOpen, CheckCircle2, FileText } from "lucide-react";

const documentationLinks = [
  {
    title: "Developers & API",
    body: "REST endpoints, auth, credits, and campaign lifecycle for builders embedding AmroGen in custom workflows.",
    href: "/developers",
    icon: FileText,
  },
  {
    title: "Lead generation feature page",
    body: "How context-first discovery works, what gets returned, and where AmroGen fits versus database-first tools.",
    href: "/features/lead-generation",
    icon: CheckCircle2,
  },
  {
    title: "Blog & guides",
    body: "Long-form research on AI SDR tools, cold email, B2B prospecting, and competitor comparisons.",
    href: "/blog",
    icon: BookOpen,
  },
];

export function HowItWorksBottomSection() {
  return (
    <>
      <section className="border-y border-border bg-secondary/35">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div>
              <span className="marketing-eyebrow mb-4 inline-flex">Ships today</span>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">What the MVP includes</h2>
              <ul className="mt-6 space-y-2 text-sm leading-7 text-muted-foreground">
                <li>• Company URL, manual lead entry, or CSV / document URL import</li>
                <li>• Coordinator-led lead research for URL campaigns (up to 25 leads)</li>
                <li>• Reviewed email sequence generation with quality scoring</li>
                <li>• Resend sending for approved email steps only</li>
                <li>• REST API and MCP access for programmatic campaigns</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-card/75 p-6">
              <p className="text-sm font-semibold text-foreground" id="roadmap">
                On the roadmap
              </p>
              <ul className="mt-4 space-y-2 text-sm leading-7 text-muted-foreground">
                <li>• LinkedIn and SMS execution channels</li>
                <li>• Expanded multi-agent orchestration</li>
                <li>• Agency and white-label workflows</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-10 max-w-3xl">
          <span className="marketing-eyebrow mb-4 inline-flex">Documentation</span>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Learn more before you launch a campaign
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
            Use these pages when you need deeper product context, API details, or SEO research content written for
            operators and builders.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {documentationLinks.map(({ title, body, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="rounded-xl border border-border bg-card/75 p-6 transition-colors hover:border-primary/50"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                <Icon size={20} className="text-primary" />
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
