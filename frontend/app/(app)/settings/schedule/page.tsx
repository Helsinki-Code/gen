"use client";

import { useEffect, useState } from "react";
import { Loader2, Clock5, CheckCircle, CalendarDays, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthToken } from "@/lib/auth/use-auth-token";
import { cn } from "@/lib/utils";

type Mode = "manual" | "daily" | "weekly" | "biweekly";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
};

const TIMEZONES = [
  { value: "UTC",                    label: "UTC" },
  { value: "America/New_York",       label: "New York (EST/EDT)" },
  { value: "America/Chicago",        label: "Chicago (CST/CDT)" },
  { value: "America/Denver",         label: "Denver (MST/MDT)" },
  { value: "America/Los_Angeles",    label: "Los Angeles (PST/PDT)" },
  { value: "Europe/London",          label: "London (GMT/BST)" },
  { value: "Europe/Paris",           label: "Paris (CET/CEST)" },
  { value: "Asia/Dubai",             label: "Dubai (GST)" },
  { value: "Asia/Kolkata",           label: "India (IST)" },
  { value: "Asia/Singapore",         label: "Singapore (SGT)" },
  { value: "Asia/Tokyo",             label: "Tokyo (JST)" },
  { value: "Australia/Sydney",       label: "Sydney (AEST/AEDT)" },
];

const MODE_CONFIG: Record<Mode, { label: string; description: string; icon: React.ElementType }> = {
  manual:   { label: "Manual Only",    icon: Zap,         description: "You manually trigger sends. No automation." },
  daily:    { label: "Daily",          icon: Clock5,      description: "Send every day at your chosen time." },
  weekly:   { label: "Once a Week",    icon: CalendarDays,description: "Send on one day per week at your chosen time." },
  biweekly: { label: "Twice a Week",   icon: CalendarDays,description: "Send on two days per week at your chosen time." },
};

export default function SchedulePage() {
  const getToken = useAuthToken();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<Mode>("manual");
  const [sendTime, setSendTime] = useState("09:00");
  const [days, setDays] = useState<string[]>([]);
  const [timezone, setTimezone] = useState("UTC");

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const cfg = await api.getScheduleSettings(token);
        setEnabled(cfg.enabled ?? false);
        setMode((cfg.mode as Mode) ?? "manual");
        setSendTime(cfg.send_time ?? "09:00");
        setDays(cfg.days ?? []);
        setTimezone(cfg.timezone ?? "UTC");
      } catch {}
      setLoading(false);
    })();
  }, [getToken]);

  function toggleDay(day: string) {
    const maxDays = mode === "weekly" ? 1 : mode === "biweekly" ? 2 : 7;
    setDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : prev.length < maxDays ? [...prev, day] : [...prev.slice(1), day]
    );
  }

  async function handleSave() {
    const token = await getToken();
    if (!token) return;
    setSaving(true);
    try {
      await api.updateScheduleSettings(token, { enabled, mode, send_time: sendTime, days, timezone });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center text-muted-foreground gap-2">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    );
  }

  const showDays = mode === "weekly" || mode === "biweekly";
  const showTime = mode !== "manual";

  return (
    <div className="p-5 lg:p-7 max-w-2xl mx-auto animate-fade-in">
      <h1 className="text-xl font-bold mb-1">Campaign Schedule</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Set when AmroGen should automatically trigger approved campaigns. The scheduler checks every 15 minutes.
      </p>

      {/* Enable toggle */}
      <div className="glass-panel rounded-xl p-4 border border-border/60 flex items-center justify-between mb-6">
        <div>
          <p className="font-medium text-sm">Auto-scheduling</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            When enabled, AmroGen triggers your approved campaigns on your chosen schedule.
          </p>
        </div>
        <button
          onClick={() => setEnabled(v => !v)}
          className={cn(
            "relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0",
            enabled ? "bg-primary" : "bg-secondary border border-border"
          )}
        >
          <span className={cn(
            "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200",
            enabled && "translate-x-5"
          )} />
        </button>
      </div>

      {/* Mode selection */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Frequency</h2>
        <div className="grid grid-cols-2 gap-3">
          {(Object.entries(MODE_CONFIG) as [Mode, typeof MODE_CONFIG[Mode]][]).map(([key, cfg]) => {
            const Icon = cfg.icon;
            return (
              <button
                key={key}
                onClick={() => { setMode(key); setDays([]); }}
                disabled={!enabled}
                className={cn(
                  "text-left p-4 rounded-xl border transition-all duration-200",
                  mode === key && enabled
                    ? "border-primary/40 bg-primary/10"
                    : "border-border/60 bg-secondary/20 hover:bg-secondary/40",
                  !enabled && "opacity-40 cursor-not-allowed"
                )}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon size={14} className={mode === key && enabled ? "text-primary" : "text-muted-foreground"} />
                  <span className="text-sm font-medium">{cfg.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{cfg.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Day picker */}
      {showDays && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Day{mode === "biweekly" ? "s" : ""} of the Week
            {mode === "biweekly" && <span className="ml-2 text-muted-foreground font-normal normal-case">pick 2</span>}
          </h2>
          <div className="flex gap-2 flex-wrap">
            {DAYS.map(day => (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                disabled={!enabled}
                className={cn(
                  "px-3 py-2 rounded-lg text-sm font-medium border transition-all",
                  days.includes(day) && enabled
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border/60 text-muted-foreground hover:bg-secondary/60",
                  !enabled && "opacity-40 cursor-not-allowed"
                )}
              >
                {DAY_LABELS[day]}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Time + timezone */}
      {showTime && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Send Time</h2>
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Time</label>
              <input
                type="time"
                value={sendTime}
                onChange={e => setSendTime(e.target.value)}
                disabled={!enabled}
                className={cn(
                  "px-3 py-2 text-sm rounded-lg border border-border bg-secondary/40 focus:outline-none focus:ring-1 focus:ring-primary/50",
                  !enabled && "opacity-40 cursor-not-allowed"
                )}
              />
            </div>
            <div className="flex-1 min-w-48">
              <label className="text-xs text-muted-foreground mb-1.5 block">Timezone</label>
              <select
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                disabled={!enabled}
                className={cn(
                  "w-full px-3 py-2 text-sm rounded-lg border border-border bg-secondary/40 focus:outline-none",
                  !enabled && "opacity-40 cursor-not-allowed"
                )}
              >
                {TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>
          </div>
        </section>
      )}

      {/* Summary */}
      {enabled && mode !== "manual" && (
        <div className="rounded-xl bg-primary/8 border border-primary/20 p-4 text-sm mb-6">
          <p className="font-medium text-primary mb-1">Schedule summary</p>
          <p className="text-muted-foreground">
            Approved campaigns will auto-trigger{" "}
            {mode === "daily" && `every day`}
            {mode === "weekly" && `every ${days[0] ?? "—"}`}
            {mode === "biweekly" && `every ${days.join(" and ") || "—"}`}
            {showTime && ` at ${sendTime} ${timezone.split("/").pop()?.replace("_", " ") ?? timezone}`}.
          </p>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        {saving ? (
          <Loader2 size={14} className="animate-spin" />
        ) : saved ? (
          <CheckCircle size={14} />
        ) : (
          <Clock5 size={14} />
        )}
        {saved ? "Saved!" : saving ? "Saving…" : "Save Schedule"}
      </button>
    </div>
  );
}
