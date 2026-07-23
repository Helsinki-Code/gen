"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Loader2, Mail, MessageSquare, AlertTriangle, ChevronDown,
  ChevronUp, Flame, Thermometer, Minus, Zap, Plane, Ban, Clock,
  CheckCircle2, Calendar, Play, Pause, XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthToken } from "@/lib/auth/use-auth-token";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CampaignStatusBadge } from "@/components/ui/campaign-status-badge";
import { ProjectProgressCard } from "@/components/ui/project-progress-card";

// ── Types ────────────────────────────────────────────────────────────────────

interface SequenceStep {
  id: string;
  step_number: number;
  day: number;
  channel: string;
  type: string;
  subject: string | null;
  content: string;
  status: string;
  scheduled_for: string | null;
  sent_at: string | null;
  error_message: string | null;
}

interface Lead {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  email: string | null;
  email_type: string | null;
  email_confidence: string | null;
  phone: string | null;
  phone_type: string | null;
  icp_fit_score: string | null;
  icp_fit: string | null;
  best_outreach_angle: string | null;
  company_website: string | null;
  company_size: string | null;
  company_industry: string | null;
  key_responsibilities: string | null;
  recent_activity: string | null;
}

interface Sequence {
  id: string;
  status: string;
  lead: Lead;
  steps: SequenceStep[];
}

interface Reply {
  id: string;
  sequence_id: string | null;
  lead_name: string | null;
  company: string | null;
  channel: string | null;
  from_email: string | null;
  subject: string | null;
  body_preview: string | null;
  body_full: string | null;
  intent: string | null;
  sentiment_score: number | null;
  next_action: string | null;
  created_at: string;
}

interface Campaign {
  id: string;
  target_url: string;
  status: string;
  leads_requested: number;
  credits_charged: number;
  created_at: string;
  error_message: string | null;
  enrichment_stats: Record<string, unknown> | null;
  icp_profiles: Array<{
    icp_id: string;
    profile_name: string;
    industries?: string[];
    pain_points?: string[];
    buying_triggers?: string[];
    firmographics?: Record<string, unknown>;
    decision_maker_map?: { initiator?: string; influencer?: string; approver?: string };
    success_metrics?: string[];
  }> | null;
}

interface CampaignStats {
  total_steps: number; sent: number; scheduled: number; failed: number; skipped: number;
  sequences_active: number; sequences_paused: number; sequences_stopped: number;
  replies_total: number; replies_hot: number; next_send_at: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDomain(url: string) {
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

function fmtDate(iso: string | null, opts?: { time?: boolean }) {
  if (!iso) return "—";
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (!opts?.time) return date;
  return `${date} ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function initials(name: string) {
  return name.split(" ").map(p => p[0]?.toUpperCase() ?? "").slice(0, 2).join("");
}

const INTENT_CONFIG: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  HOT:          { label: "HOT",          icon: Flame,        cls: "text-red-400 bg-red-400/10 border-red-400/25" },
  WARM:         { label: "WARM",         icon: Thermometer,  cls: "text-amber-400 bg-amber-400/10 border-amber-400/25" },
  NEUTRAL:      { label: "NEUTRAL",      icon: Minus,        cls: "text-muted-foreground bg-secondary border-border" },
  OBJECTION:    { label: "OBJECTION",    icon: Zap,          cls: "text-yellow-400 bg-yellow-400/10 border-yellow-400/25" },
  OUT_OF_OFFICE:{ label: "OOO",          icon: Plane,        cls: "text-blue-400 bg-blue-400/10 border-blue-400/25" },
  UNSUBSCRIBE:  { label: "UNSUB",        icon: Ban,          cls: "text-muted-foreground bg-secondary border-border" },
};

// ── Step Dot ─────────────────────────────────────────────────────────────────

function StepDot({ step }: { step: SequenceStep }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const dotCls = cn(
    "w-3 h-3 rounded-full border-2 cursor-pointer transition-all hover:scale-125",
    step.status === "sent"      && "bg-emerald-500 border-emerald-500",
    step.status === "scheduled" && "bg-amber-400/70 border-amber-400",
    step.status === "pending"   && "bg-muted border-border",
    step.status === "skipped"   && "bg-muted border-dashed border-muted-foreground/40",
    step.status === "failed"    && "bg-red-500 border-red-500",
  );

  const channelIcon = step.channel === "email"
    ? <Mail size={10} className="text-muted-foreground" />
    : <MessageSquare size={10} className="text-muted-foreground" />;

  return (
    <div ref={ref} className="relative flex flex-col items-center gap-0.5">
      <div className={dotCls} onClick={() => setOpen(v => !v)} title={`Day ${step.day} ${step.channel}`} />
      <span className="text-[9px] text-muted-foreground/60">D{step.day}</span>

      {open && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-72 glass-panel-elevated rounded-xl border border-border p-3 shadow-xl text-xs">
          <div className="flex items-center gap-2 mb-2">
            {channelIcon}
            <span className="font-semibold capitalize">{step.channel} · Day {step.day}</span>
            <span className={cn(
              "ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded",
              step.status === "sent" && "text-emerald-400 bg-emerald-400/10",
              step.status === "scheduled" && "text-amber-400 bg-amber-400/10",
              step.status === "pending" && "text-muted-foreground bg-secondary",
              step.status === "failed" && "text-red-400 bg-red-400/10",
            )}>
              {step.status}
            </span>
          </div>
          {step.subject && <p className="font-medium mb-1 truncate">{step.subject}</p>}
          <p className="text-muted-foreground line-clamp-4">{step.content}</p>
          {step.sent_at && (
            <p className="mt-2 text-emerald-400/80 flex items-center gap-1">
              <CheckCircle2 size={10} />
              Sent {fmtDate(step.sent_at, { time: true })}
            </p>
          )}
          {step.scheduled_for && step.status === "scheduled" && (
            <p className="mt-2 text-amber-400/80 flex items-center gap-1">
              <Calendar size={10} />
              Scheduled {fmtDate(step.scheduled_for, { time: true })}
            </p>
          )}
          {step.error_message && (
            <p className="mt-2 text-red-400 text-[10px]">{step.error_message}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sequence Row ─────────────────────────────────────────────────────────────

function SequenceRow({
  seq,
  reply,
  onAction,
}: {
  seq: Sequence;
  reply: Reply | null;
  onAction: (seqId: string, action: "pause" | "resume" | "stop") => void;
}) {
  const [showMilestones, setShowMilestones] = useState(false);
  const lead = seq.lead;
  const emailSteps = seq.steps.filter(s => s.channel === "email").sort((a, b) => a.day - b.day);
  const smsSteps = seq.steps.filter(s => s.channel === "sms").sort((a, b) => a.day - b.day);
  const intent = reply?.intent;
  const icpN = parseInt(lead.icp_fit_score ?? "0");

  const seqStatusCls = {
    approved: "bg-emerald-400/10 text-emerald-400 border-emerald-400/25",
    active:   "bg-emerald-400/10 text-emerald-400 border-emerald-400/25",
    paused:   "bg-amber-400/10 text-amber-400 border-amber-400/25",
    stopped:  "bg-secondary text-muted-foreground border-border",
    pending:  "bg-secondary text-muted-foreground border-border",
  }[seq.status] ?? "bg-secondary text-muted-foreground border-border";

  return (
    <div className="glass-panel rounded-xl p-4 border border-border/60">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
          {initials(lead.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{lead.name}</span>
            {lead.title && <span className="text-xs text-muted-foreground">· {lead.title}</span>}
            {lead.company && <span className="text-xs text-muted-foreground">· {lead.company}</span>}
          </div>
          {lead.best_outreach_angle && (
            <p className="text-xs text-muted-foreground/70 mt-0.5 italic line-clamp-1">
              &ldquo;{lead.best_outreach_angle}&rdquo;
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {icpN > 0 && (
            <span className={cn(
              "text-[11px] font-bold px-1.5 py-0.5 rounded border",
              icpN >= 85 ? "bg-primary/15 text-primary border-primary/25"
                        : icpN >= 75 ? "bg-blue-400/15 text-blue-400 border-blue-400/25"
                        : "bg-secondary text-muted-foreground border-border"
            )}>
              {icpN}
            </span>
          )}
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", seqStatusCls)}>
            {seq.status}
          </span>
          {intent && (
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded border font-medium",
              INTENT_CONFIG[intent]?.cls ?? "text-muted-foreground bg-secondary border-border"
            )}>
              {INTENT_CONFIG[intent]?.label ?? intent}
            </span>
          )}
        </div>
      </div>

      {/* Timeline dots */}
      <div className="space-y-2 pl-12">
        {emailSteps.length > 0 && (
          <div className="flex items-center gap-3">
            <Mail size={11} className="text-muted-foreground shrink-0 w-4" />
            <div className="flex items-end gap-2 flex-wrap">
              {emailSteps.map(s => <StepDot key={s.id} step={s} />)}
            </div>
          </div>
        )}
        {smsSteps.length > 0 && (
          <div className="flex items-center gap-3">
            <MessageSquare size={11} className="text-muted-foreground shrink-0 w-4" />
            <div className="flex items-end gap-2 flex-wrap">
              {smsSteps.map(s => <StepDot key={s.id} step={s} />)}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mt-3 pl-12">
        {seq.status === "approved" || seq.status === "active" ? (
          <button
            onClick={() => onAction(seq.id, "pause")}
            className="text-[11px] flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pause size={10} /> Pause
          </button>
        ) : seq.status === "paused" ? (
          <button
            onClick={() => onAction(seq.id, "resume")}
            className="text-[11px] flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <Play size={10} /> Resume
          </button>
        ) : null}
        {seq.status !== "stopped" && (
          <button
            onClick={() => onAction(seq.id, "stop")}
            className="text-[11px] flex items-center gap-1 text-muted-foreground hover:text-red-400 transition-colors"
          >
            <XCircle size={10} /> Stop
          </button>
        )}
        <button
          onClick={() => setShowMilestones(v => !v)}
          className="text-[11px] flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors ml-auto"
        >
          {showMilestones ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          {showMilestones ? "Hide steps" : "Step detail"}
        </button>
      </div>

      {showMilestones && (
        <div className="mt-3 pl-12">
          <ProjectProgressCard
            title={`${lead.name}${lead.company ? ` · ${lead.company}` : ""}`}
            projectManager="AmroGen AI"
            dueDate={
              seq.steps.find(s => s.status === "scheduled")
                ? fmtDate(seq.steps.find(s => s.status === "scheduled")!.scheduled_for)
                : seq.steps.find(s => s.status === "sent")
                  ? `Last sent ${fmtDate(seq.steps.filter(s => s.status === "sent").at(-1)?.sent_at ?? null)}`
                  : "No upcoming steps"
            }
            milestones={seq.steps
              .sort((a, b) => a.day - b.day)
              .map(s => ({
                title: `Day ${s.day} — ${s.channel.charAt(0).toUpperCase() + s.channel.slice(1)}${s.subject ? ` · ${s.subject}` : ""}`,
                description: s.status === "sent"
                  ? `Sent ${fmtDate(s.sent_at, { time: true })}`
                  : s.status === "scheduled"
                  ? `Scheduled for ${fmtDate(s.scheduled_for, { time: true })}`
                  : s.status === "failed"
                  ? `Failed: ${s.error_message ?? "unknown error"}`
                  : s.status === "skipped"
                  ? "Skipped (landline)"
                  : "Pending",
                completed: s.status === "sent",
              }))}
          />
        </div>
      )}
    </div>
  );
}

// ── Reply Card ────────────────────────────────────────────────────────────────

function ReplyCard({ reply, onPause }: { reply: Reply; onPause?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = INTENT_CONFIG[reply.intent ?? ""] ?? { label: reply.intent ?? "—", icon: Minus, cls: "text-muted-foreground" };
  const Icon = cfg.icon;

  return (
    <div className={cn("rounded-lg border p-3 text-xs", cfg.cls)}>
      <div className="flex items-start gap-2 mb-2">
        <Icon size={13} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{reply.lead_name || "Unknown"}</p>
          {reply.company && <p className="text-muted-foreground">{reply.company}</p>}
        </div>
        <button onClick={() => setExpanded(v => !v)} className="text-muted-foreground hover:text-foreground">
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>
      <p className="text-muted-foreground line-clamp-2">{reply.body_preview}</p>
      {expanded && reply.body_full && reply.body_full !== reply.body_preview && (
        <p className="mt-2 text-foreground/80 whitespace-pre-wrap">{reply.body_full}</p>
      )}
      {onPause && (reply.intent === "HOT" || reply.intent === "WARM") && (
        <div className="flex gap-2 mt-2">
          <button
            onClick={onPause}
            className="text-[11px] px-2 py-0.5 rounded border border-current hover:bg-current/10 transition-colors"
          >
            Pause Sequence
          </button>
        </div>
      )}
    </div>
  );
}

// ── Intent Group ─────────────────────────────────────────────────────────────

function IntentGroup({
  intent,
  replies,
  defaultOpen,
  onPause,
}: {
  intent: string;
  replies: Reply[];
  defaultOpen: boolean;
  onPause?: (reply: Reply) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const cfg = INTENT_CONFIG[intent] ?? { label: intent, icon: Minus, cls: "" };
  const Icon = cfg.icon;

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 py-2 text-xs font-semibold hover:text-foreground transition-colors"
      >
        <Icon size={13} className={cfg.cls.split(" ")[0]} />
        <span>{cfg.label}</span>
        <span className="ml-1 text-muted-foreground font-normal">({replies.length})</span>
        {open ? <ChevronUp size={13} className="ml-auto" /> : <ChevronDown size={13} className="ml-auto" />}
      </button>
      {open && (
        <div className="space-y-2 mb-3">
          {replies.map(r => (
            <ReplyCard
              key={r.id}
              reply={r}
              onPause={onPause ? () => onPause(r) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── ICP Intelligence Panel ────────────────────────────────────────────────────

function IcpIntelligence({ profiles }: { profiles: Campaign["icp_profiles"] }) {
  const [open, setOpen] = useState(false);
  if (!profiles?.length) return null;

  return (
    <div className="glass-panel rounded-xl border border-border/60 mt-4">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-5 py-4 text-sm font-semibold"
      >
        Campaign Intelligence
        {open ? <ChevronUp size={15} className="ml-auto" /> : <ChevronDown size={15} className="ml-auto" />}
      </button>
      {open && (
        <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {profiles.map(p => (
            <div key={p.icp_id} className="rounded-lg border border-border/60 bg-secondary/20 p-4 space-y-3 text-xs">
              <div className="font-semibold">{p.profile_name}</div>

              {p.industries?.length ? (
                <div>
                  <p className="text-muted-foreground mb-1">Industries</p>
                  <div className="flex flex-wrap gap-1">
                    {p.industries.map(i => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px]">{i}</span>
                    ))}
                  </div>
                </div>
              ) : null}

              {p.pain_points?.length ? (
                <div>
                  <p className="text-muted-foreground mb-1">Pain Points</p>
                  <ul className="space-y-0.5 text-foreground/80">
                    {p.pain_points.map(pp => <li key={pp} className="flex items-start gap-1"><span className="text-primary mt-0.5">·</span>{pp}</li>)}
                  </ul>
                </div>
              ) : null}

              {p.buying_triggers?.length ? (
                <div>
                  <p className="text-muted-foreground mb-1">Buying Triggers</p>
                  <ul className="space-y-0.5 text-foreground/80">
                    {p.buying_triggers.map(bt => <li key={bt} className="flex items-start gap-1"><span className="text-emerald-400 mt-0.5">·</span>{bt}</li>)}
                  </ul>
                </div>
              ) : null}

              {p.decision_maker_map && (
                <div>
                  <p className="text-muted-foreground mb-1">Decision Makers</p>
                  <div className="space-y-0.5">
                    {p.decision_maker_map.initiator && <p><span className="text-muted-foreground">Initiator:</span> {p.decision_maker_map.initiator}</p>}
                    {p.decision_maker_map.influencer && <p><span className="text-muted-foreground">Influencer:</span> {p.decision_maker_map.influencer}</p>}
                    {p.decision_maker_map.approver && <p><span className="text-muted-foreground">Approver:</span> {p.decision_maker_map.approver}</p>}
                  </div>
                </div>
              )}

              {p.success_metrics?.length ? (
                <div>
                  <p className="text-muted-foreground mb-1">Success Metrics</p>
                  <ul className="space-y-0.5 text-foreground/80">
                    {p.success_metrics.map(sm => <li key={sm} className="flex items-start gap-1"><span className="text-amber-400 mt-0.5">·</span>{sm}</li>)}
                  </ul>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CampaignPage() {
  const { id } = useParams<{ id: string }>();
  const getToken = useAuthToken();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const t = await getToken();
      if (!t) return;
      setToken(t);
      try {
        const [camp, seqs, reps] = await Promise.all([
          api.getCampaign(t, id),
          api.getSequences(t, id),
          api.getReplies(t, id),
        ]);
        setCampaign(camp as Campaign);
        setSequences(seqs as Sequence[]);
        setReplies(reps as Reply[]);

        try {
          const s = await api.getCampaignStats(t, id);
          setStats(s);
        } catch {}
      } catch {}
      setLoading(false);
    })();
  }, [id, getToken]);

  async function handleSequenceAction(seqId: string, action: "pause" | "resume" | "stop") {
    if (!token) return;
    const statusMap = { pause: "paused", resume: "approved", stop: "stopped" };
    try {
      await api.updateSequence(token, id, seqId, { status: statusMap[action] });
      setSequences(prev => prev.map(s => s.id === seqId ? { ...s, status: statusMap[action] } : s));
    } catch {}
  }

  async function handlePauseFromReply(reply: Reply) {
    if (!token || !reply.sequence_id) return;
    await handleSequenceAction(reply.sequence_id, "pause");
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-1.5rem)] items-center justify-center text-muted-foreground gap-2">
        <Loader2 size={18} className="animate-spin" />
        Loading campaign…
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Campaign not found.{" "}
        <Link href="/dashboard" className="text-primary hover:underline">Go back</Link>
      </div>
    );
  }

  const domain = formatDomain(campaign.target_url);
  const needsReview = ["leads_review", "review"].includes(campaign.status);
  const isRunning = ["generating_leads", "leads_ready", "generating_sequences"].includes(campaign.status);

  // Group replies by intent
  const INTENT_ORDER = ["HOT", "WARM", "OBJECTION", "NEUTRAL", "OUT_OF_OFFICE", "UNSUBSCRIBE"];
  const repliesByIntent: Record<string, Reply[]> = {};
  for (const r of replies) {
    const k = r.intent ?? "NEUTRAL";
    if (!repliesByIntent[k]) repliesByIntent[k] = [];
    repliesByIntent[k].push(r);
  }

  // Map sequence_id → reply
  const replyBySeqId: Record<string, Reply> = {};
  for (const r of replies) {
    if (r.sequence_id && !replyBySeqId[r.sequence_id]) replyBySeqId[r.sequence_id] = r;
  }

  return (
    <div className="p-5 lg:p-7 max-w-[1400px] mx-auto animate-fade-in">
      {/* Back */}
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
        <ArrowLeft size={15} />
        Back to dashboard
      </Link>

      {/* Header */}
      <div className="glass-panel rounded-xl p-5 border border-border/60 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold glow-text">{domain}</h1>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <CampaignStatusBadge status={campaign.status} />
              {stats && (
                <>
                  <span className="text-xs text-muted-foreground">{sequences.length} leads</span>
                  <span className="text-xs text-muted-foreground">{stats.sent} sent</span>
                  <span className="text-xs text-muted-foreground">{stats.replies_total} replied</span>
                  {stats.replies_hot > 0 && (
                    <span className="text-xs text-red-400 flex items-center gap-1">
                      <Flame size={11} />{stats.replies_hot} HOT
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {needsReview && (
              <Button size="sm" variant="outline" className="text-amber-400 border-amber-400/30">
                <AlertTriangle size={13} className="mr-1.5" />
                {campaign.status === "leads_review" ? "Review Leads" : "Review Sequences"}
              </Button>
            )}
            {isRunning && (
              <div className="flex items-center gap-2 text-sm text-blue-400">
                <Loader2 size={14} className="animate-spin" />
                Pipeline running…
              </div>
            )}
            {campaign.status === "approved" && (
              <Link href={`/campaigns/new?resume=${id}`}>
                <Button size="sm">Launch Sending</Button>
              </Link>
            )}
            {campaign.error_message && (
              <p className="text-xs text-red-400 max-w-xs truncate">{campaign.error_message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* Left: Sequence Timelines */}
        <div className="xl:col-span-3 space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Lead Sequences ({sequences.length})
          </h2>
          {sequences.length === 0 ? (
            <div className="glass-panel rounded-xl p-8 border border-border/60 text-center text-muted-foreground text-sm">
              No sequences yet
            </div>
          ) : (
            sequences.map(seq => (
              <SequenceRow
                key={seq.id}
                seq={seq}
                reply={replyBySeqId[seq.id] ?? null}
                onAction={handleSequenceAction}
              />
            ))
          )}
        </div>

        {/* Right: Smart Reply Inbox */}
        <div className="xl:col-span-2">
          <div className="glass-panel rounded-xl p-5 border border-border/60 sticky top-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Replies ({replies.length})
            </h2>
            {replies.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                <Clock size={24} className="mx-auto mb-2 opacity-40" />
                No replies yet
              </div>
            ) : (
              <div className="space-y-0 divide-y divide-border/40">
                {INTENT_ORDER.filter(k => repliesByIntent[k]?.length).map((k, i) => (
                  <IntentGroup
                    key={k}
                    intent={k}
                    replies={repliesByIntent[k]}
                    defaultOpen={i === 0}
                    onPause={handlePauseFromReply}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ICP Intelligence */}
      <IcpIntelligence profiles={campaign.icp_profiles} />
    </div>
  );
}
