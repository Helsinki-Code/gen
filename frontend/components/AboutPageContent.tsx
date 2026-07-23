import Image from "next/image";
import Link from "next/link";
import { Building2, MapPin } from "lucide-react";
import { MarketingFooter, MarketingNav } from "@/components/MarketingPage";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const founderQuotes = [
  {
    quote:
      "Hemant is without doubt one of life's achievers. He is tenacious and always focussed on delivery. He is an expert in his field and I cannot praise him enough for the work he does for us.",
    author: "Ray Murphy",
    role: "Principal Consultant — Cards & Payments specialist at PSD Group",
  },
  {
    quote:
      "Immense intellect, passion, drive and the best Java software architect I have ever worked with. Hemant brought all of these attributes to my team along with a natural ability to see peoples strengths and weaknesses enabling him to perform the role of scrum master very effectively.",
    author: "Alex Ralph",
    role: "Senior DevOps Engineer at Anaplan",
  },
  {
    quote:
      "He is a seasoned software engineer with many years of practical industry experience. I would recommend Hemant to anyone looking for an experienced professional to deliver complex solutions.",
    author: "Paul Watson",
    role: "Sales Director @ Areteans | Pega Suite Expert",
  },
];

export function AboutPageContent() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <MarketingNav />

      <main className="container mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <header className="mb-14 text-center sm:mb-16">
          <h1 className="mb-4 text-3xl font-bold text-foreground sm:text-4xl md:text-5xl">
            About <span className="text-primary">AmroGen</span>
          </h1>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
            AI-native B2B outreach from Agentic AI Ltd — built with the same engineering discipline used in regulated
            enterprise environments.
          </p>
        </header>

        <section className="mb-14 sm:mb-16" aria-labelledby="product-heading">
          <Card className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <h2 id="product-heading" className="mb-5 text-2xl font-semibold text-foreground">
              The AmroGen product
            </h2>
            <div className="space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
              <p>
                <strong className="text-foreground">AmroGen</strong> is the B2B outreach platform from{" "}
                <strong className="text-foreground">Agentic AI Ltd</strong>. Give it a company URL and it researches the
                account, finds verified decision-makers, writes personalised email sequences, scores its own output, and
                prepares approved sends through Resend.
              </p>
              <p>
                The MVP is deliberately focused: one coordinator-led pipeline, email-first outreach, a capped lead pack,
                and human approval before anything reaches a prospect. That keeps cost predictable while still removing
                the repetitive research-and-copy work that slows most outbound teams down.
              </p>
              <p>
                AmroGen applies the same engineering discipline used in large regulated enterprises: strong architecture,
                secure design, clear governance, and practical delivery. The goal is reviewed automation your team can
                trust — not blind autopilot.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/how-it-works">See how it works</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/documentation">Documentation</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/pricing">Pricing</Link>
              </Button>
            </div>
          </Card>
        </section>

        <section className="mb-14 sm:mb-16" aria-labelledby="company-heading">
          <div className="grid items-start gap-8 md:grid-cols-2 md:gap-12">
            <div>
              <h2 id="company-heading" className="mb-5 flex items-center gap-2 text-2xl font-semibold text-foreground">
                <Building2 className="h-6 w-6 shrink-0 text-primary" aria-hidden />
                About Agentic AI Ltd
              </h2>
              <div className="space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                <p>
                  Agentic AI Amro was created to bring secure, intelligent, and practical AI solutions to small and
                  medium businesses. We apply the same architecture standards used inside large global enterprises to
                  every solution we deliver.
                </p>
                <p>
                  Our goal is simple: help businesses benefit from the AI revolution, stay within budget, and scale
                  confidently as technology continues to evolve.
                </p>
                <p className="flex items-start gap-2">
                  <MapPin className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span>
                    <strong className="text-foreground">Agentic AI Ltd</strong> — Tunbridge Wells, Kent, UK
                  </span>
                </p>
              </div>
            </div>

            <Card className="rounded-xl border border-border bg-card p-6 sm:p-8">
              <div className="mb-5 flex justify-center">
                <Image
                  src="/media/images/Hemant-Image.jpeg"
                  alt="Hemant Joshi, Founder and Chief Cloud & AI Architect"
                  width={320}
                  height={400}
                  className="w-full max-w-xs rounded-xl border border-border object-cover"
                />
              </div>
              <p className="mb-1 text-center marketing-section-label">
                Founder
              </p>
              <p className="text-center text-lg font-semibold text-foreground">Hemant Joshi</p>
              <p className="text-center text-sm font-medium text-primary">Chief Cloud &amp; AI Architect</p>
              <p className="mt-1 text-center text-xs text-muted-foreground">Leader of the Agentic AI Amro team</p>
            </Card>
          </div>
        </section>

        <section className="mb-14 sm:mb-16" aria-labelledby="founder-heading">
          <h2 id="founder-heading" className="mb-5 text-2xl font-semibold text-foreground">
            Our founder and visionary
          </h2>
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            <p>
              Hemant Joshi is a highly respected technology architect with more than twenty-five years of experience
              delivering intelligent systems, cloud modernisation, and AI-enabled automation across Tier One banks and
              global financial institutions.
            </p>
            <p>
              He has contributed to major programmes at{" "}
              <strong className="text-foreground">HSBC, Deutsche Bank, JP Morgan, UBS, Vanguard</strong>, and{" "}
              <strong className="text-foreground">Virgin Money</strong>. He has designed cloud-native, event-driven, and
              AI-powered platforms using <strong className="text-foreground">AWS, Azure, PEGA</strong>, and{" "}
              <strong className="text-foreground">OpenShift</strong>, supporting operations across Europe, India, and
              China.
            </p>
            <p>
              Hemant is also a recognised thought leader with more than three hundred international presentations and
              widely published work on cloud, AI, and automation. As a visionary, he focuses on creating AI solutions
              that help businesses grow, remain competitive, and adapt to changing times while keeping budgets in mind.
            </p>
          </div>
        </section>

        <section className="mb-14 grid gap-8 sm:mb-16 md:grid-cols-2">
          <Card className="rounded-xl border border-border bg-card p-6 sm:p-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">Our approach</h2>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              We design AI solutions that work in real business environments — outbound automation, reviewed copy,
              integration engineering, and practical workflow tools.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {[
                "Strong architecture",
                "Secure design",
                "Clear governance",
                "Stable engineering",
                "Practical, results-focused delivery",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="font-bold text-primary">•</span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-6 overflow-hidden rounded-xl border border-border">
              <Image
                src="/media/images/our_approach.jpeg"
                alt="Enterprise-grade AI approach for growing businesses"
                width={640}
                height={480}
                className="hidden h-auto w-full object-cover dark:block"
              />
              <Image
                src="/media/images/our-approach-light.png"
                alt="Enterprise-grade AI approach for growing businesses"
                width={640}
                height={480}
                className="block h-auto w-full object-cover dark:hidden"
              />
            </div>
          </Card>

          <Card className="rounded-xl border border-border bg-card p-6 sm:p-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">Credibility you can trust</h2>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              Because of Hemant&apos;s experience inside global financial institutions and regulated sectors, every
              Agentic AI solution benefits from strong security standards, structured documentation, audit-ready
              processes, and reliable engineering.
            </p>
            <p className="mb-6 text-sm font-medium italic text-foreground">
              If a system performs in a bank, it will perform reliably for your business.
            </p>
            <div className="overflow-hidden rounded-xl border border-border">
              <Image
                src="/media/images/credibility.jpeg"
                alt="Credibility you can trust in regulated enterprise environments"
                width={640}
                height={480}
                className="hidden h-auto w-full object-cover dark:block"
              />
              <Image
                src="/media/images/credibility-light.png"
                alt="Credibility you can trust in regulated enterprise environments"
                width={640}
                height={480}
                className="block h-auto w-full object-cover dark:hidden"
              />
            </div>
          </Card>
        </section>

        <section className="mb-14 sm:mb-16" aria-labelledby="recognition-heading">
          <h2 id="recognition-heading" className="mb-6 text-center text-2xl font-semibold text-foreground">
            Founder recognition
          </h2>
          <div className="mx-auto max-w-3xl space-y-4">
            {founderQuotes.map((item) => (
              <Card
                key={item.author}
                className="rounded-xl border border-border border-l-4 border-l-primary bg-card p-5 sm:p-6"
              >
                <p className="mb-3 text-sm italic leading-relaxed text-muted-foreground">&ldquo;{item.quote}&rdquo;</p>
                <p className="text-sm font-medium text-primary">
                  — {item.author}, {item.role}
                </p>
              </Card>
            ))}
          </div>
        </section>

        <Card className="rounded-xl border border-border bg-muted/20 p-6 text-center sm:p-10">
          <h2 className="mb-3 text-xl font-semibold text-foreground sm:text-2xl">Ready to explore AmroGen?</h2>
          <p className="mx-auto mb-6 max-w-xl text-sm text-muted-foreground sm:text-base">
            Start with one company URL, review the leads and sequences, and decide what deserves to go out.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/sign-up">Start your first campaign</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/how-it-works">Watch the workflow</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pricing">View pricing</Link>
            </Button>
          </div>
        </Card>
      </main>

      <MarketingFooter />
    </div>
  );
}
