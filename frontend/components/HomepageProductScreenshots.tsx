"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { X, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";

const screenshots = [
  {
    src: "/assets/images/screenshots/dashbboard.png",
    alt: "AmroGen dashboard showing campaign overview and pipeline status",
    title: "Campaign dashboard",
    body: "Monitor active outreach campaigns, pipeline stages, and recent activity from one workspace.",
    cta: { label: "Sign in to dashboard →", href: "/dashboard" },
  },
  {
    src: "/assets/images/screenshots/new-campaign.png",
    alt: "AmroGen new campaign form with company URL and outreach settings",
    title: "Launch a new campaign",
    body: "Start B2B outreach from a company URL — sequences, personas, and send settings in one flow.",
    cta: { label: "Start a campaign →", href: "/sign-up" },
  },
  {
    src: "/assets/images/screenshots/list_of_campaigns.png",
    alt: "AmroGen campaigns list with status filters and actions",
    title: "Campaign list & filters",
    body: "Browse and manage campaigns with clear status, last activity, and quick actions.",
    cta: { label: "How campaigns work →", href: "/how-it-works" },
  },
  {
    src: "/assets/images/screenshots/campaign_details.png",
    alt: "AmroGen campaign detail with sequence steps and lead pipeline",
    title: "Campaign detail & sequence",
    body: "Drill into a campaign — sequence steps, leads, and agent pipeline progress.",
    cta: { label: "Read documentation →", href: "/documentation" },
  },
  {
    src: "/assets/images/screenshots/schedule.png",
    alt: "AmroGen campaign schedule and send timing settings",
    title: "Schedule & send timing",
    body: "Control when outreach goes out — set send windows, timezone, and daily limits per campaign.",
    cta: { label: "How it works →", href: "/how-it-works" },
  },
  {
    src: "/assets/images/screenshots/credits.png",
    alt: "AmroGen credits and billing settings page",
    title: "Credits & usage",
    body: "Transparent credit balance and usage for outreach volume and AI generation.",
    cta: { label: "View pricing →", href: "/pricing" },
  },
  {
    src: "/assets/images/screenshots/connections.png",
    alt: "AmroGen email and sender connections settings",
    title: "Sender connections",
    body: "Connect your Resend account and configure sender identities for reviewed outreach.",
    cta: { label: "Read documentation →", href: "/documentation" },
  },
  {
    src: "/assets/images/screenshots/api_key.png",
    alt: "AmroGen API key management page",
    title: "API & developer access",
    body: "Generate and manage API keys to trigger campaigns programmatically or via MCP.",
    cta: { label: "Developer docs →", href: "/developers" },
  },
  {
    src: "/assets/images/screenshots/contact_page.png",
    alt: "AmroGen contact and support page",
    title: "Get in touch",
    body: "Reach the AmroGen team directly — onboarding, credit questions, or custom plans.",
    cta: { label: "Contact us →", href: "/contact" },
  },
];

export default function HomepageProductScreenshots() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const open = (i: number) => setLightboxIndex(i);
  const close = () => setLightboxIndex(null);

  const prev = useCallback(() => {
    setLightboxIndex((i) => (i === null ? 0 : (i - 1 + screenshots.length) % screenshots.length));
  }, []);

  const next = useCallback(() => {
    setLightboxIndex((i) => (i === null ? 0 : (i + 1) % screenshots.length));
  }, []);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIndex, prev, next]);

  const active = lightboxIndex !== null ? screenshots[lightboxIndex] : null;

  return (
    <section className="mx-auto max-w-6xl px-6 pb-24" aria-labelledby="screenshots-heading">
      <span className="marketing-eyebrow mb-4 inline-flex">Product screenshots</span>
      <h2 id="screenshots-heading" className="heading-safe text-2xl font-semibold tracking-tight sm:text-3xl">
        See <span className="text-primary">AmroGen</span> in the product
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
        Real captures from the outreach workspace. Tap any image for a full-screen view — zoom and swipe between
        screens there, not on this page.
      </p>

      <div className="mt-10 space-y-10">
        {screenshots.map((shot, i) => {
          const imageLeft = i % 2 === 0;
          return (
            <div
              key={shot.src + i}
              className={`flex flex-col gap-6 sm:flex-row sm:items-center ${imageLeft ? "" : "sm:flex-row-reverse"}`}
            >
              {/* Image */}
              <button
                type="button"
                className="group relative w-full shrink-0 overflow-hidden rounded-xl border border-border bg-card/75 shadow-sm transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.2),0_4px_20px_hsl(var(--primary)/0.1)] sm:w-[55%]"
                onClick={() => open(i)}
                aria-label={`View full screen: ${shot.title}`}
              >
                <img
                  src={shot.src}
                  alt={shot.alt}
                  className="aspect-[16/9] w-full object-cover transition-transform duration-300 group-hover:scale-[1.015]"
                  loading="lazy"
                />
                <span className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-md bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur opacity-80 transition-opacity group-hover:opacity-100">
                  <Maximize2 size={11} />
                  Tap to view full screen
                </span>
              </button>

              {/* Text */}
              <div className="flex-1 px-1">
                <h3 className="text-lg font-semibold">{shot.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{shot.body}</p>
                <Link
                  href={shot.cta.href}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary transition-gap hover:gap-2 hover:underline underline-offset-4"
                >
                  {shot.cta.label}
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={`Screenshot: ${active.title}`}
        >
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X size={20} />
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Previous screenshot"
          >
            <ChevronLeft size={22} />
          </button>

          <div
            className="mx-16 max-h-[85vh] max-w-5xl overflow-hidden rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={active.src}
              alt={active.alt}
              className="h-auto max-h-[75vh] w-full object-contain"
            />
            <div className="bg-black/60 px-5 py-3 text-white">
              <p className="text-sm font-semibold">{active.title}</p>
              <p className="mt-0.5 text-xs text-white/70">{active.body}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Next screenshot"
          >
            <ChevronRight size={22} />
          </button>

          <div className="absolute bottom-6 flex gap-2">
            {screenshots.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(idx); }}
                className={`h-2 w-2 rounded-full transition-colors ${idx === lightboxIndex ? "bg-white" : "bg-white/40"}`}
                aria-label={`Go to screenshot ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
