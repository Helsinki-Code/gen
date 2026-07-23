"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2, Flame, Thermometer, Minus, Zap, Plane, Ban,
  Mail, MessageSquare, ArrowUpRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthToken } from "@/lib/auth/use-auth-token";
import { cn } from "@/lib/utils";

interface InboxItem {
  reply_id: string;
  sequence_id: string | null;
  campaign_id: string | null;
  campaign_url: string | null;
  lead_name: string | null;
  company: string | null;
  lead_title: string | null;
  channel: string | null;
  from_email: string | null;
  subject: string | null;
  body_preview: string | null;
  body_full: string | null;
  intent: string | null;
  sentiment_score: number | null;
  next_action: string | null;
  received_at: string | null;
  created_at: string;
  sequence_status: string | null;
  outreach_step: {
    day: number;
    channel: string;
    subject: string | null;
    sent_at: string | null;
  } | null;
}

const INTENT_CONFIG: Record<string, {
  label: string; icon: React.ElementType;
  dot: string; card: string; tab: string;
}> = {
  HOT:          { label: "HOT",     icon: Flame,       dot: "bg-red-500",         card: "border-red-400/30 bg-red-400/5",      tab: "text-red-400" },
  WARM:         { label: "WARM",    icon: Thermometer, dot: "bg-amber-500",       card: "border-amber-400/30 bg-amber-400/5",  tab: "text-amber-400" },
  NEUTRAL:      { label: "Neutral", icon: Minus,       dot: "bg-muted-foreground",card: "border-border bg-secondary/20",        tab: "text-muted-foreground" },
  OBJECTION:    { label: "Object.", icon: Zap,         dot: "bg-yellow-500",      card: "border-yellow-400/30 bg-yellow-400/5",tab: "text-yellow-400" },
  OUT_OF_OFFICE:{ label: "OOO",     icon: Plane,       dot: "bg-blue-400",        card: "border-blue-400/30 bg-blue-400/5",    tab: "text-blue-400" },
  UNSUBSCRIBE:  { label: "Unsub",   icon: Ban,         dot: "bg-muted-foreground",card: "border-border bg-secondary/20",        tab: "text-muted-foreground" },
};

const INTENT_ORDER = ["HOT", "WARM", "OBJECTION", "NEUTRAL", "OUT_OF_OFFICE", "UNSUBSCRIBE"];

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ReplyDetail({ item, token }: { item: InboxItem; token: string | null }) {
  const [pausing, setPausing] = useState(false);
  const [paused, setPaused] = useState(item.sequence_status === "paused");

  async function handlePause() {
    if (!token || !item.sequence_id || !item.campaign_id) return;
    setPausing(true);
    try {
      await api.updateSequence(token, item.campaign_id, item.sequence_id, { status: "paused" });
      setPaused(true);
    } catch {}
    setPausing(false);
  }

  const cfg = INTENT_CONFIG[item.intent ?? ""] ?? { label: item.intent, icon: Minus, dot: "", card: "", tab: "" };

  return (
    <div className="h-full flex flex-col p-5 overflow-y-auto">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className={cn("w-2.5 h-2.5 rounded-full", cfg.dot)} />
          <span className={cn("text-xs font-bold uppercase", cfg.tab)}>{cfg.label}</span>
          {item.channel === "email" ? <Mail size={12} className="text-muted-foreground" /> : <MessageSquare size={12} className="text-muted-foreground" />}
          <span className="text-xs text-muted-foreground ml-auto">{timeAgo(item.received_at ?? item.created_at)}</span>
        </div>
        <h2 className="font-semibold">{item.lead_name || "Unknown"}</h2>
        {item.company && <p className="text-sm text-muted-foreground">{item.company}</p>}
        {item.from_email && <p className="text-xs text-muted-foreground">{item.from_email}</p>}
      </div>

      {/* Subject */}
      {item.subject && (
        <p className="text-sm font-medium mb-3">{item.subject}</p>
      )}

      {/* Body */}
      <div className={cn("rounded-xl border p-4 text-sm text-foreground/90 mb-5 whitespace-pre-wrap", cfg.card)}>
        {item.body_full || item.body_preview || "(no content)"}
      </div>

      {/* Outreach context */}
      {item.outreach_step && (
        <div className="rounded-lg bg-secondary/30 border border-border/40 p-3 text-xs text-muted-foreground mb-5">
          <p className="font-medium text-foreground/80 mb-0.5">Original outreach</p>
          Day {item.outreach_step.day} {item.outreach_step.channel}
          {item.outreach_step.subject ? ` — "${item.outreach_step.subject}"` : ""}
          {item.outreach_step.sent_at ? ` · sent ${new Date(item.outreach_step.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mt-auto pt-4 border-t border-border/40">
        {item.campaign_id && (
          <Link href={`/campaigns/${item.campaign_id}`}>
            <button className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-secondary/60 transition-colors flex items-center gap-1.5">
              View Campaign <ArrowUpRight size={11} />
            </button>
          </Link>
        )}
        {item.sequence_id && item.campaign_id && !paused && (item.intent === "HOT" || item.intent === "WARM") && (
          <button
            onClick={handlePause}
            disabled={pausing}
            className="text-xs px-3 py-1.5 rounded-lg border border-amber-400/30 text-amber-400 hover:bg-amber-400/10 transition-colors"
          >
            {pausing ? "Pausing…" : "Pause Sequence"}
          </button>
        )}
        {paused && (
          <span className="text-xs text-amber-400 flex items-center gap-1.5">
            ✓ Sequence paused
          </span>
        )}
        {item.intent === "HOT" && (
          <button className="text-xs px-3 py-1.5 rounded-lg border border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/10 transition-colors">
            Mark Converted
          </button>
        )}
      </div>
    </div>
  );
}

export default function InboxPage() {
  const getToken = useAuthToken();
  const [token, setToken] = useState<string | null>(null);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [intentFilter, setIntentFilter] = useState<string>("all");
  const [selected, setSelected] = useState<InboxItem | null>(null);

  useEffect(() => {
    (async () => {
      const t = await getToken();
      if (!t) return;
      setToken(t);
      try {
        const data = await api.getInbox(t, { per_page: 50 });
        const inbox = data as InboxItem[];
        setItems(inbox);
        if (inbox.length > 0) setSelected(inbox[0]);
      } catch {}
      setLoading(false);
    })();
  }, [getToken]);

  const TABS = [
    { key: "all", label: "All" },
    ...INTENT_ORDER.map(k => ({ key: k, label: INTENT_CONFIG[k]?.label ?? k })),
  ];

  const filtered = intentFilter === "all"
    ? items
    : items.filter(i => i.intent === intentFilter);

  return (
    <div className="flex flex-col h-[calc(100vh-1.5rem)] p-3 pl-3">
      <div className="flex items-center justify-between mb-4 px-2">
        <h1 className="text-xl font-bold glow-text">Inbox</h1>
        <span className="text-sm text-muted-foreground">{items.length} replies</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1 text-muted-foreground gap-2">
          <Loader2 size={18} className="animate-spin" />
          Loading inbox…
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
          <Mail size={36} className="mb-3 opacity-30" />
          <p>No replies yet</p>
        </div>
      ) : (
        <div className="flex gap-3 flex-1 min-h-0">
          {/* Left: Reply List */}
          <div className="w-72 shrink-0 flex flex-col glass-panel rounded-xl border border-border/60 overflow-hidden">
            {/* Filter tabs */}
            <div className="flex overflow-x-auto border-b border-border/60 px-2 gap-1 py-2">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setIntentFilter(t.key)}
                  className={cn(
                    "text-[11px] font-medium px-2 py-1 rounded whitespace-nowrap transition-colors",
                    intentFilter === t.key
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label}
                  {t.key !== "all" && items.filter(i => i.intent === t.key).length > 0 && (
                    <span className="ml-1 opacity-60">
                      {items.filter(i => i.intent === t.key).length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Reply items */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/40">
              {filtered.length === 0 ? (
                <p className="text-center text-muted-foreground text-xs py-8">No replies</p>
              ) : filtered.map(item => {
                const cfg = INTENT_CONFIG[item.intent ?? ""] ?? { dot: "bg-muted-foreground", tab: "" };
                return (
                  <button
                    key={item.reply_id}
                    onClick={() => setSelected(item)}
                    className={cn(
                      "w-full text-left px-3 py-3 hover:bg-secondary/40 transition-colors",
                      selected?.reply_id === item.reply_id && "bg-secondary/60"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("w-2 h-2 rounded-full shrink-0", cfg.dot)} />
                      <span className="text-xs font-semibold truncate flex-1">{item.lead_name || "Unknown"}</span>
                      <span className="text-[10px] text-muted-foreground">{timeAgo(item.received_at ?? item.created_at)}</span>
                    </div>
                    {item.company && <p className="text-[11px] text-muted-foreground pl-4">{item.company}</p>}
                    {item.body_preview && (
                      <p className="text-[11px] text-muted-foreground/70 pl-4 mt-0.5 line-clamp-2">{item.body_preview}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Reply Detail */}
          <div className="flex-1 glass-panel rounded-xl border border-border/60 overflow-hidden">
            {selected ? (
              <ReplyDetail item={selected} token={token} />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Select a reply to read
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
