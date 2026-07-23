"use client";

import { useState } from "react";
import { Calendar, CheckCircle } from "lucide-react";
import { AMROMEET_BOOKING_URL } from "@/lib/brand";

export default function AmroMeetWidget() {
  const [iframeLoaded, setIframeLoaded] = useState(false);

  return (
    <div className="w-full">
      <div className="mb-6 px-4 text-center">
        <div className="mb-3 flex items-center justify-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            AmroMeet Calendar
          </span>
        </div>
        <h2 className="mb-2 font-display text-2xl font-bold sm:text-3xl lg:text-4xl">
          Choose your perfect time
        </h2>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground sm:text-base">
          Select a date and time that works best for you. Used across Agentic AI, AmroGen, AmroAI Academy, and other
          Amro products.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 px-4 sm:grid-cols-3">
        {[
          { label: "30 minutes", desc: "focused session" },
          { label: "Completely free", desc: "no obligations" },
          { label: "Google Meet", desc: "link sent to email" },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-center gap-2 text-xs">
            <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">{item.label}</span> — {item.desc}
            </span>
          </div>
        ))}
      </div>

      <div className="w-full px-4">
        <div className="mx-auto max-w-5xl">
          <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            {!iframeLoaded && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
                <div className="text-center">
                  <div className="mx-auto mb-2 h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <p className="text-xs text-muted-foreground">Loading AmroMeet Calendar…</p>
                </div>
              </div>
            )}
            <iframe
              src={AMROMEET_BOOKING_URL}
              title="AmroMeet Booking Calendar"
              className="w-full rounded-xl border-0"
              style={{ minHeight: 600 }}
              allow="camera; microphone"
              loading="lazy"
              onLoad={() => setIframeLoaded(true)}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 px-4 text-center">
        <div className="border-t border-border/50 pt-3">
          <p className="mb-1 text-xs text-muted-foreground">Having trouble with the booking widget?</p>
          <a
            href={AMROMEET_BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-primary/80"
          >
            <Calendar className="h-3 w-3" />
            Open booking page in a new tab
          </a>
        </div>
      </div>
    </div>
  );
}
