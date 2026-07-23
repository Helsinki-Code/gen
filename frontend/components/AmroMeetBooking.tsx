"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BookingType = "pipeline_demo" | "outbound_workflow" | "enterprise_consultation";

const BOOKING_CARDS: {
  type: BookingType;
  icon: string;
  title: string;
  duration: string;
  desc: string;
  features: string[];
}[] = [
  {
    type: "pipeline_demo",
    icon: "🎯",
    title: "Live Pipeline Demo",
    duration: "30 min",
    desc: "Walk through a real company URL — lead discovery, personalised sequences, quality review, and Resend-ready outreach.",
    features: ["Live pipeline run", "Your target account", "Q&A with our team"],
  },
  {
    type: "outbound_workflow",
    icon: "📧",
    title: "Outbound Workflow Review",
    duration: "30 min",
    desc: "Review your current stack, credits model, Resend setup, and whether AmroGen fits your GTM motion today.",
    features: ["Stack mapping", "Credits & pricing", "Human approval workflow"],
  },
  {
    type: "enterprise_consultation",
    icon: "🏢",
    title: "Enterprise Consultation",
    duration: "45 min",
    desc: "For agencies and larger teams — API/MCP integration, volume usage, and custom deployment planning.",
    features: ["API & MCP options", "Volume planning", "Technical architecture"],
  },
];

const TIME_SLOTS = [
  { value: "morning", label: "Morning (9 am – 12 pm)" },
  { value: "afternoon", label: "Afternoon (12 pm – 5 pm)" },
  { value: "evening", label: "Evening (5 pm – 8 pm)" },
];

const inputClasses =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors";

export default function AmroMeetBooking() {
  const [selectedType, setSelectedType] = useState<BookingType | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedType) return;

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: company.trim() || undefined,
          bookingType: selectedType,
          preferredDate: date || undefined,
          preferredTime: time || undefined,
          timezone: tz || undefined,
          message: message.trim() || undefined,
        }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      setSuccess(true);
      setName("");
      setEmail("");
      setCompany("");
      setDate("");
      setTime("");
      setMessage("");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="relative overflow-hidden py-8 sm:py-10" id="book-demo">
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-6 max-w-3xl text-center">
          <span className="mb-3 inline-block rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
            AmroMeet Calendar
          </span>
          <h2 className="mb-3 font-display text-2xl font-bold sm:text-3xl lg:text-4xl">
            Book a live demo{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              with AmroMeet
            </span>
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            AmroMeet is the unified booking calendar across Agentic AI and Amro products. Schedule a personalised AmroGen
            session — pick a session type, choose your time, and our team confirms within 24 hours.
          </p>
        </div>

        <div className="mb-12 grid gap-6 lg:grid-cols-3">
          {BOOKING_CARDS.map((card) => (
            <button
              key={card.type}
              type="button"
              onClick={() => {
                setSelectedType(card.type);
                setSuccess(false);
                setError("");
              }}
              aria-pressed={selectedType === card.type}
              className={cn(
                "cursor-pointer rounded-xl border border-border bg-card/85 p-6 text-left backdrop-blur-sm transition-all duration-300",
                selectedType === card.type
                  ? "ring-2 ring-primary shadow-md"
                  : "hover:border-primary/50 hover:shadow-sm",
              )}
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-xl">
                {card.icon}
              </div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg font-bold text-foreground">{card.title}</h3>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {card.duration}
                </span>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">{card.desc}</p>
              <ul className="space-y-1">
                {card.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] text-primary">
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        {selectedType && (
          <div className="mx-auto max-w-2xl animate-fade-in rounded-2xl border border-border bg-card/85 p-6 backdrop-blur-sm sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="booking-name" className="mb-1 block text-sm font-medium text-foreground">
                    Name *
                  </label>
                  <input
                    id="booking-name"
                    type="text"
                    required
                    placeholder="Your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label htmlFor="booking-email" className="mb-1 block text-sm font-medium text-foreground">
                    Email *
                  </label>
                  <input
                    id="booking-email"
                    type="email"
                    required
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClasses}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="booking-company" className="mb-1 block text-sm font-medium text-foreground">
                  Company <span className="text-muted-foreground">(optional)</span>
                </label>
                <input
                  id="booking-company"
                  type="text"
                  placeholder="Your organisation"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className={inputClasses}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="booking-date" className="mb-1 block text-sm font-medium text-foreground">
                    Preferred date
                  </label>
                  <input
                    id="booking-date"
                    type="date"
                    min={tomorrow}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label htmlFor="booking-time" className="mb-1 block text-sm font-medium text-foreground">
                    Preferred time
                  </label>
                  <select
                    id="booking-time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    aria-label="Preferred time slot"
                    className={inputClasses}
                  >
                    <option value="">Select a time slot</option>
                    {TIME_SLOTS.map((slot) => (
                      <option key={slot.value} value={slot.label}>
                        {slot.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="booking-message" className="mb-1 block text-sm font-medium text-foreground">
                  Message <span className="text-muted-foreground">(optional)</span>
                </label>
                <textarea
                  id="booking-message"
                  rows={3}
                  placeholder="Target account URL, team size, or anything you'd like us to cover…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={inputClasses}
                />
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-center" role="alert">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full" size="lg">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Booking…
                  </>
                ) : (
                  "Book my demo session"
                )}
              </Button>
            </form>

            {success && (
              <div className="mt-4 rounded-lg border border-primary/30 bg-primary/10 p-4 text-center" role="status">
                <p className="font-semibold text-primary">Demo booked! Check your email for confirmation.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  We&apos;ll reach out within 24 hours to confirm your time slot.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
