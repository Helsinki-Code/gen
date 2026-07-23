"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Globe,
  Loader2,
  Rocket,
} from "lucide-react";
import { api, streamCampaignProgress } from "@/lib/api";
import { useAuthToken } from "@/lib/auth/use-auth-token";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import PipelineLiveView from "@/components/PipelineLiveView";

type Step = "target" | "progress" | "leads_review" | "review" | "send";

interface PipelineEvent {
  type: string;
  data: Record<string, unknown>;
}

export default function NewCampaignPage() {
  const getToken = useAuthToken();
  const router = useRouter();

  const [step, setStep] = useState<Step>("target");
  const [url, setUrl] = useState("");
  const [leadCount, setLeadCount] = useState(25);
  const [campaignId, setCampaignId] = useState("");
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [senderName, setSenderName] = useState("");
  const [leadsFound, setLeadsFound] = useState<number | null>(null);
  const [seqReady, setSeqReady] = useState<number | null>(null);
  const [currentPhaseLabel, setCurrentPhaseLabel] = useState("Initialising…");
  const [patternLeadNames, setPatternLeadNames] = useState<string[]>([]);
  const [leadsForReview, setLeadsForReview] = useState<Array<{
    id: string; name: string; title: string; company: string;
    email: string; email_type: string | null; icp_fit_score: string | null; selected: boolean;
  }>>([]);
  const [confirmingLeads, setConfirmingLeads] = useState(false);

  function pushEvent(type: string, data: Record<string, unknown>) {
    // Counts
    if (type === "leads_found") setLeadsFound(data.count as number);
    if (type === "sequences_ready") setSeqReady(data.count as number);

    // Phase label — legacy custom events
    if (type === "status_change") {
      const s = data.status as string;
      if (s === "generating_leads") setCurrentPhaseLabel("URL-to-Leads Agent scanning target…");
      if (s === "leads_review") setCurrentPhaseLabel("Leads ready — awaiting your approval");
      if (s === "generating_sequences") setCurrentPhaseLabel("Outreach Sequence Agent writing…");
      if (s === "review") setCurrentPhaseLabel("All agents complete — sequences ready for review");
    }
    if (type === "agent_running") {
      const a = (data.agent as string).replace(/_/g, " ");
      setCurrentPhaseLabel(`${a} generating sequences…`);
    }
    if (type === "orchestrator_reviewing") setCurrentPhaseLabel("Quality review in progress…");
    if (type === "agent_accepted") setCurrentPhaseLabel(`Output accepted (score: ${data.score}/10)`);
    if (type === "agent_rejected") setCurrentPhaseLabel(`Output rejected — retry ${(data.attempt as number) + 1}…`);

    // Phase label — native multi-agent thread events
    if (type === "session_created") setCurrentPhaseLabel("Session started — agents initialising…");
    if (type === "thread_created") setCurrentPhaseLabel(`Spawning ${data.agent_name}…`);
    if (type === "thread_running") setCurrentPhaseLabel(`${data.agent_name} is running…`);
    if (type === "thread_done") setCurrentPhaseLabel(`${data.agent_name} complete`);
    if (type === "orchestrator_message" && data.text) {
      const preview = String(data.text).slice(0, 80);
      setCurrentPhaseLabel(preview.length < String(data.text).length ? preview + "…" : preview);
    }

    setEvents((prev) => [...prev, { type, data }]);
  }

  async function handleStart() {
    if (!url.trim()) return;
    setError("");
    setLoading(true);
    setEvents([]);
    setCurrentPhaseLabel("Initialising pipeline…");

    try {
      const token = await getToken();
      if (!token) return;
      const campaign = (await api.createCampaign(token, {
        target_url: url,
        leads_requested: leadCount,
      })) as { id: string };

      setCampaignId(campaign.id);
      setStep("progress");

      const stop = streamCampaignProgress(
        token,
        campaign.id,
        (ev) => {
          const { type, ...rest } = ev as { type: string; [key: string]: unknown };
          pushEvent(type, rest);
          if (type === "status_change" && rest.status === "leads_review") {
            // HITL gate 1: fetch leads, show lead review step
            api.getLeads(token, campaign.id).then((rawLeads) => {
              const leads = rawLeads as Array<{
                id: string; name: string; title: string; company: string;
                email: string; email_type: string | null; icp_fit_score: string | null;
              }>;
              setLeadsForReview(leads.map(l => ({ ...l, selected: true })));
              setLeadsFound(leads.length);
            }).catch(() => {});
            setTimeout(() => setStep("leads_review"), 800);
          }
          if (type === "status_change" && rest.status === "review") {
            stop();
            api.getLeads(token, campaign.id).then((leads) => {
              const names = (leads as Array<{ name: string; email_type: string | null }>)
                .filter((l) => l.email_type === "pattern_derived")
                .map((l) => l.name);
              setPatternLeadNames(names);
            }).catch(() => {});
            setTimeout(() => setStep("review"), 1500);
          }
        },
        () => {
          setCurrentPhaseLabel("Pipeline complete");
          setTimeout(() => setStep("review"), 1500);
        }
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  async function handleConfirmLeads() {
    const token = await getToken();
    if (!token) return;
    setConfirmingLeads(true);
    try {
      const removedIds = leadsForReview
        .filter((l) => !l.selected)
        .map((l) => l.id);
      await api.confirmLeads(token, campaignId, removedIds);
      // Re-enter progress mode to watch sequence generation
      setStep("progress");
      setCurrentPhaseLabel("Sequence generation starting…");
      const stop = streamCampaignProgress(
        token,
        campaignId,
        (ev) => {
          const { type, ...rest } = ev as { type: string; [key: string]: unknown };
          pushEvent(type, rest);
          if (type === "status_change" && rest.status === "review") {
            stop();
            const token2 = token;
            api.getLeads(token2, campaignId).then((leads) => {
              const names = (leads as Array<{ name: string; email_type: string | null }>)
                .filter((l) => l.email_type === "pattern_derived")
                .map((l) => l.name);
              setPatternLeadNames(names);
            }).catch(() => {});
            setTimeout(() => setStep("review"), 1500);
          }
        },
        () => { setTimeout(() => setStep("review"), 1500); }
      );
    } catch {
      setConfirmingLeads(false);
    }
  }

  async function handleApproveAll() {
    const token = await getToken();
    if (!token) return;
    await api.approveAll(token, campaignId);
    setStep("send");
  }

  async function handleSend() {
    const token = await getToken();
    if (!token) return;
    await api.triggerSend(token, campaignId, senderName);
    router.push(`/campaigns/${campaignId}`);
  }

  const steps: Step[] = ["target", "progress", "leads_review", "review", "send"];
  const stepLabels = ["Target", "Pipeline", "Leads", "Sequences", "Launch"];
  const currentIndex = steps.indexOf(step);

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">New Campaign</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure and launch your AI outreach pipeline</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-10 overflow-x-auto pb-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2 shrink-0">
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-300",
                step === s
                  ? "bg-primary text-primary-foreground glow-border"
                  : currentIndex > i
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-secondary text-muted-foreground border border-border"
              )}
            >
              {currentIndex > i ? <CheckCircle2 size={14} /> : i + 1}
            </div>
            <span
              className={cn(
                "text-sm",
                step === s ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              {stepLabels[i]}
            </span>
            {i < 3 && <span className="text-border mx-2">—</span>}
          </div>
        ))}
      </div>

      {/* Step 1: Target */}
      {step === "target" && (
        <Card elevated className="max-w-lg">
          <CardContent className="pt-6 space-y-6">
            <div>
              <Label htmlFor="target-url" className="mb-2 block">
                Target company URL
              </Label>
              <div className="relative">
                <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="target-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://acme.com"
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">
                Number of leads: <span className="text-primary font-bold">{leadCount}</span>
              </Label>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={leadCount}
                onChange={(e) => setLeadCount(Number(e.target.value))}
                className="w-full accent-primary h-2 rounded-full cursor-pointer"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>10</span>
                <span>100</span>
              </div>
            </div>

            <div className="glass-panel rounded-lg p-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Estimated cost</span>
              <strong className="text-primary">{Math.ceil(leadCount / 10) * 8} credits</strong>
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <Button
              onClick={handleStart}
              disabled={loading || !url.trim()}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Starting…
                </>
              ) : (
                <>
                  Generate Leads & Sequences
                  <ArrowRight size={18} />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Pipeline */}
      {step === "progress" && (
        <PipelineLiveView
          events={events}
          currentPhaseLabel={currentPhaseLabel}
          leadsFound={leadsFound}
          seqReady={seqReady}
        />
      )}

      {/* Step 2.5: HITL Lead Review */}
      {step === "leads_review" && (
        <Card elevated className="max-w-2xl">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">Review your leads</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {leadsFound} leads discovered. Remove any you don&apos;t want targeted
                  before sequences are generated.
                </p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {leadsForReview.filter(l => l.selected).length} / {leadsForReview.length} selected
              </span>
            </div>

            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {leadsForReview.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => setLeadsForReview(prev =>
                    prev.map(l => l.id === lead.id ? { ...l, selected: !l.selected } : l)
                  )}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-200 cursor-pointer",
                    lead.selected
                      ? "border-primary/30 bg-primary/5"
                      : "border-border/40 bg-secondary/20 opacity-50",
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                    lead.selected ? "bg-primary border-primary" : "border-border"
                  )}>
                    {lead.selected && <CheckCircle2 size={10} className="text-primary-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{lead.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{lead.title} · {lead.company}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {lead.email_type === "pattern_derived" && (
                      <span className="text-[10px] text-destructive border border-destructive/30 px-1.5 py-0.5 rounded">⚠ Pattern email</span>
                    )}
                    {lead.icp_fit_score && (
                      <span className="text-[11px] font-bold text-primary">{lead.icp_fit_score}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLeadsForReview(prev => prev.map(l => ({ ...l, selected: true })))}
              >
                Select all
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirmLeads}
                disabled={confirmingLeads || leadsForReview.filter(l => l.selected).length === 0}
              >
                {confirmingLeads
                  ? <><Loader2 size={14} className="animate-spin" /> Generating sequences…</>
                  : <><ArrowRight size={14} /> Generate sequences for {leadsForReview.filter(l => l.selected).length} leads</>
                }
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review */}
      {step === "review" && (
        <Card elevated className="max-w-lg">
          <CardContent className="pt-6 space-y-5">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-accent/10 border border-accent/20">
              <div className="w-12 h-12 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center">
                <CheckCircle2 size={24} className="text-accent" />
              </div>
              <div>
                <p className="font-semibold">All agents complete</p>
                <p className="text-sm text-muted-foreground">
                  {leadsFound ?? "—"} leads · {seqReady ?? "—"} sequences · Orchestrator approved
                </p>
              </div>
            </div>

            {patternLeadNames.length > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-sm">
                <AlertTriangle size={16} className="text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-destructive">Pattern-inferred email addresses</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {patternLeadNames.join(", ")} — emails were derived by guessing the pattern
                    (e.g. first.last@company.com). Verify with Hunter.io or ZeroBounce before sending
                    to protect your domain reputation.
                  </p>
                </div>
              </div>
            )}

            <p className="text-sm text-muted-foreground leading-relaxed">
              The Orchestrator reviewed every agent&apos;s output before approving.
              Review and edit individual sequences, or approve all to schedule sending.
            </p>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => router.push(`/campaigns/${campaignId}`)}
              >
                Review sequences
              </Button>
              <Button className="flex-1" onClick={handleApproveAll}>
                Approve all
                <ArrowRight size={16} />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Launch */}
      {step === "send" && (
        <Card elevated className="max-w-lg">
          <CardContent className="pt-6 space-y-6">
            <div>
              <Label htmlFor="sender-name" className="mb-2 block">
                Your name{" "}
                <span className="text-muted-foreground font-normal">
                  (replaces [Seller Name] in all messages)
                </span>
              </Label>
              <Input
                id="sender-name"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Alex Johnson"
              />
            </div>

            <div className="rounded-lg p-4 bg-amber-500/10 border border-amber-500/25 text-sm text-amber-700 dark:text-amber-100/90">
              Email steps send via Resend (if connected) or Gmail. SMS steps send via Twilio (if connected).
              LinkedIn steps appear as a copy queue — no automated posting.
              Connect email and SMS channels at Settings.
            </div>

            <Button onClick={handleSend} className="w-full" size="lg">
              <Rocket size={18} />
              Launch Campaign
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
