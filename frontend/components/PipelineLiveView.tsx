"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Cpu,
  Globe,
  Mail,
  MessageSquare,
  Search,
  Sparkles,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressiveFluxLoader, type ProgressiveFluxPhase } from "@/components/ProgressiveFluxLoader";

// ── Types ────────────────────────────────────────────────────────────────────

export type PipelinePhase =
  | "queued"
  | "generating_leads"
  | "generating_sequences"
  | "review"
  | "failed";

export type AgentState = "idle" | "running" | "done" | "failed";

export interface PipelineEvent {
  type: string;
  data: Record<string, unknown>;
}

export interface PipelineLiveViewProps {
  events: PipelineEvent[];
  currentPhaseLabel: string;
  leadsFound: number | null;
  seqReady: number | null;
}

// ── Real agent definitions (names match Anthropic session exactly) ────────────

const AGENTS = [
  {
    id: "orchestrator",
    name: "Multi-Agent Orchestrator",
    shortName: "Orchestrator",
    role: "Coordinates all agents · manages the pipeline",
    icon: Cpu,
    color: "text-violet-400",
    bgActive: "bg-violet-500/10 border-violet-500/30",
    bgDone: "bg-emerald-500/5 border-emerald-500/20",
    glow: "0 0 20px -4px hsl(263 70% 60% / 0.35)",
    matchKeys: ["multi-agent orchestrator", "campaign orchestrator", "orchestrator"],
  },
  {
    id: "url-to-leads",
    name: "URL-to-Leads Agent",
    shortName: "Lead Discovery",
    role: "Analyzes company website · finds & enriches leads",
    icon: Search,
    color: "text-sky-400",
    bgActive: "bg-sky-500/10 border-sky-500/30",
    bgDone: "bg-emerald-500/5 border-emerald-500/20",
    glow: "0 0 20px -4px hsl(199 89% 60% / 0.35)",
    matchKeys: ["url-to-leads", "url to leads", "lead"],
  },
  {
    id: "outreach-sequence",
    name: "Outreach Sequence Agent",
    shortName: "Sequence Writer",
    role: "Writes personalized multi-channel sequences per lead",
    icon: Bot,
    color: "text-primary",
    bgActive: "bg-primary/10 border-primary/30",
    bgDone: "bg-emerald-500/5 border-emerald-500/20",
    glow: "0 0 20px -4px hsl(var(--primary) / 0.35)",
    matchKeys: ["outreach sequence", "sequence agent", "outreach seq"],
  },
  {
    id: "email-outreach",
    name: "Email Outreach Agent",
    shortName: "Email Agent",
    role: "Queues & dispatches email steps via Resend / Gmail",
    icon: Mail,
    color: "text-amber-400",
    bgActive: "bg-amber-500/10 border-amber-500/30",
    bgDone: "bg-emerald-500/5 border-emerald-500/20",
    glow: "0 0 20px -4px hsl(45 93% 47% / 0.35)",
    matchKeys: ["email outreach", "email agent"],
  },
  {
    id: "sms-outreach",
    name: "SMS Outreach Agent",
    shortName: "SMS Agent",
    role: "Dispatches 160-char SMS steps via Twilio",
    icon: MessageSquare,
    color: "text-green-400",
    bgActive: "bg-green-500/10 border-green-500/30",
    bgDone: "bg-emerald-500/5 border-emerald-500/20",
    glow: "0 0 20px -4px hsl(142 71% 45% / 0.35)",
    matchKeys: ["sms outreach", "sms agent"],
  },
] as const;

type AgentId = (typeof AGENTS)[number]["id"];

function resolveAgent(name: string): (typeof AGENTS)[number] | null {
  const lower = name.toLowerCase();
  return AGENTS.find((a) => a.matchKeys.some((k) => lower.includes(k))) ?? null;
}

// ── Flux phases ───────────────────────────────────────────────────────────────

const FLUX_PHASES: ProgressiveFluxPhase[] = [
  { at: 0,   label: "pipeline queued" },
  { at: 8,   label: "session starting" },
  { at: 15,  label: "orchestrator online" },
  { at: 22,  label: "scanning target URL" },
  { at: 40,  label: "enriching leads" },
  { at: 55,  label: "writing sequences" },
  { at: 75,  label: "quality review" },
  { at: 90,  label: "sequences ready" },
  { at: 100, label: "campaign ready!" },
];

// ── Conversation message types ────────────────────────────────────────────────

type MsgKind = "dispatch" | "response" | "thinking" | "tool" | "phase" | "error" | "info";

interface ConvMessage {
  id: number;
  ts: string;
  kind: MsgKind;
  agentName: string;
  agentColor: string;
  direction: "out" | "in" | "none";
  text: string;
  toolName?: string;
}

let _mid = 0;
function mkMsg(
  kind: MsgKind,
  agentName: string,
  agentColor: string,
  direction: "out" | "in" | "none",
  text: string,
  toolName?: string,
): ConvMessage {
  return {
    id: _mid++,
    ts: new Date().toLocaleTimeString("en-US", { hour12: false }),
    kind,
    agentName,
    agentColor,
    direction,
    text,
    toolName,
  };
}

// ── Message bubble ────────────────────────────────────────────────────────────

const KIND_STYLE: Record<MsgKind, string> = {
  dispatch:  "bg-primary/10 border border-primary/20",
  response:  "bg-secondary border border-border/60",
  thinking:  "bg-violet-500/5 border border-violet-500/15 italic",
  tool:      "bg-amber-500/5 border border-amber-500/15",
  phase:     "bg-sky-500/5 border border-sky-500/15",
  error:     "bg-destructive/10 border border-destructive/25",
  info:      "bg-secondary/40 border border-border/40",
};

function ConvBubble({ msg }: { msg: ConvMessage }) {
  const isOut = msg.direction === "out";
  const isNone = msg.direction === "none";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex gap-2", isOut ? "flex-row" : "flex-row-reverse", isNone && "justify-center")}
    >
      {!isNone && (
        <div className="shrink-0 mt-0.5">
          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap", msg.agentColor, "bg-current/10")}>
            {msg.agentName.split(" ")[0]}
          </span>
        </div>
      )}
      <div className={cn("max-w-[82%] rounded-xl px-3 py-2", KIND_STYLE[msg.kind], isNone && "max-w-full text-center")}>
        {msg.toolName && (
          <div className="flex items-center gap-1 mb-1 text-amber-400">
            <Wrench size={10} />
            <span className="text-[10px] font-mono font-semibold">{msg.toolName}</span>
          </div>
        )}
        <p className="text-[11px] text-foreground/90 leading-snug break-words">
          {msg.kind === "thinking" && <span className="text-violet-400/70 mr-1">thinking:</span>}
          {msg.text}
        </p>
        <p className="text-[9px] text-muted-foreground/40 mt-1 text-right tabular-nums">{msg.ts}</p>
      </div>
    </motion.div>
  );
}

// ── Agent pipeline step ───────────────────────────────────────────────────────

function AgentStep({
  agent,
  state,
  detail,
  isLast,
}: {
  agent: (typeof AGENTS)[number];
  state: AgentState;
  detail: string;
  isLast: boolean;
}) {
  const Icon = agent.icon;
  const isRunning = state === "running";
  const isDone = state === "done";
  const isFailed = state === "failed";
  const isIdle = state === "idle";

  return (
    <div className="flex flex-col items-center">
      <motion.div
        layout
        className={cn(
          "relative w-full rounded-xl border px-3 py-3 transition-all duration-500",
          isRunning ? agent.bgActive : isDone ? agent.bgDone : "border-border/40 bg-card/30",
          isFailed && "border-destructive/30 bg-destructive/5",
        )}
        style={isRunning ? { boxShadow: agent.glow } : undefined}
      >
        <div className="flex items-start gap-2">
          {/* Icon */}
          <div className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 mt-0.5",
            isRunning ? cn("border-current/30", agent.bgActive.split(" ")[0])
              : isDone  ? "bg-emerald-500/10 border-emerald-500/25"
              : "bg-secondary border-border/50",
          )}>
            {isDone ? (
              <CheckCircle2 size={13} className="text-emerald-400" />
            ) : isRunning ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
              >
                <Icon size={13} className={agent.color} strokeWidth={1.75} />
              </motion.div>
            ) : (
              <Icon size={13} className={cn(isIdle ? "text-muted-foreground/40" : agent.color)} strokeWidth={1.75} />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className={cn("text-[11px] font-semibold leading-tight", isIdle ? "text-muted-foreground/50" : "text-foreground")}>
                {agent.shortName}
              </p>
              {/* pulse */}
              <motion.span
                animate={isRunning ? { opacity: [1, 0.2, 1] } : {}}
                transition={isRunning ? { duration: 1.2, repeat: Infinity } : {}}
                className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  isRunning ? cn(agent.color, "opacity-90")
                    : isDone   ? "bg-emerald-400"
                    : isFailed ? "bg-destructive"
                    : "bg-muted-foreground/20",
                )}
              />
            </div>
            <p className={cn("text-[10px] mt-0.5 leading-tight truncate", isIdle ? "text-muted-foreground/30" : "text-muted-foreground/70")}>
              {detail || (isRunning ? agent.role : isIdle ? "waiting…" : agent.role)}
            </p>
          </div>
        </div>

        {/* Status badge */}
        <div className="mt-2">
          <span className={cn(
            "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
            isRunning ? cn("text-current", agent.bgActive.split(" ")[0])
              : isDone   ? "bg-emerald-500/15 text-emerald-400"
              : isFailed ? "bg-destructive/15 text-destructive"
              : "bg-muted text-muted-foreground/40",
          )}>
            {isRunning ? "running" : isDone ? "done" : isFailed ? "failed" : "idle"}
          </span>
        </div>
      </motion.div>

      {/* Connector line */}
      {!isLast && (
        <div className="flex flex-col items-center my-1">
          <div className={cn(
            "w-px h-4 transition-all duration-500",
            isDone ? "bg-emerald-500/40" : isRunning ? cn(agent.color, "opacity-40") : "bg-border/30",
          )} />
          <div className={cn(
            "w-1.5 h-1.5 rounded-full transition-all duration-500",
            isDone ? "bg-emerald-500/40" : isRunning ? cn(agent.color, "opacity-40") : "bg-border/30",
          )} />
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PipelineLiveView({
  events,
  currentPhaseLabel,
  leadsFound,
  seqReady,
}: PipelineLiveViewProps) {
  const [agentStates, setAgentStates] = useState<Record<AgentId, AgentState>>({
    orchestrator: "idle",
    "url-to-leads": "idle",
    "outreach-sequence": "idle",
    "email-outreach": "idle",
    "sms-outreach": "idle",
  });
  const [agentDetails, setAgentDetails] = useState<Record<AgentId, string>>({
    orchestrator: "",
    "url-to-leads": "",
    "outreach-sequence": "",
    "email-outreach": "",
    "sms-outreach": "",
  });
  const [progress, setProgress] = useState(0);
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [phase, setPhase] = useState<PipelinePhase>("queued");
  const [queueWarning, setQueueWarning] = useState(false);
  const [slowWarning, setSlowWarning] = useState(false);
  const [activeCount, setActiveCount] = useState(0);

  const processedRef = useRef(0);
  const convRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const lastEventTime = useRef(Date.now());

  const isComplete = phase === "review";
  const isFailed = phase === "failed";

  // Show warning if no events for 120s while still running
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isComplete && !isFailed) {
        setSlowWarning(Date.now() - lastEventTime.current > 120_000);
      }
    }, 15_000);
    return () => clearInterval(interval);
  }, [isComplete, isFailed]);

  function bump(target: number) {
    if (target > progressRef.current) {
      progressRef.current = target;
      setProgress(target);
    }
  }

  useEffect(() => {
    const newEvts = events.slice(processedRef.current);
    if (!newEvts.length) return;
    processedRef.current = events.length;
    lastEventTime.current = Date.now();
    setSlowWarning(false);

    const newMsgs: ConvMessage[] = [];
    const stateUpdates: Partial<Record<AgentId, AgentState>> = {};
    const detailUpdates: Partial<Record<AgentId, string>> = {};

    for (const { type, data } of newEvts) {
      switch (type) {

        case "status_change": {
          const s = data.status as string;
          if (s === "generating_leads") {
            setPhase("generating_leads");
            stateUpdates["orchestrator"] = "running";
            stateUpdates["url-to-leads"] = "running";
            bump(15);
            newMsgs.push(mkMsg("phase", "Orchestrator", "text-violet-400", "none", "Phase 1 — Lead Discovery started"));
          } else if (s === "generating_sequences") {
            setPhase("generating_sequences");
            stateUpdates["url-to-leads"] = "done";
            stateUpdates["outreach-sequence"] = "running";
            bump(50);
            newMsgs.push(mkMsg("phase", "Orchestrator", "text-violet-400", "none", "Phase 2 — Sequence Generation started"));
          } else if (s === "review") {
            setPhase("review");
            stateUpdates["orchestrator"] = "done";
            stateUpdates["outreach-sequence"] = "done";
            stateUpdates["email-outreach"] = "done";
            stateUpdates["sms-outreach"] = "done";
            bump(100);
            newMsgs.push(mkMsg("phase", "Orchestrator", "text-emerald-400", "none", "All agents complete — campaign ready for review"));
          } else if (s === "failed") {
            setPhase("failed");
          }
          break;
        }

        case "session_created":
          stateUpdates["orchestrator"] = "running";
          bump(8);
          newMsgs.push(mkMsg("info", "System", "text-muted-foreground", "none", `Session started · ${String(data.session_id ?? "").slice(0, 22)}…`));
          break;

        case "thread_created": {
          const name = String(data.agent_name ?? "");
          const agent = resolveAgent(name);
          if (agent) {
            stateUpdates[agent.id] = "running";
            detailUpdates[agent.id] = "starting up…";
            bump(progressRef.current + 3);
          }
          newMsgs.push(mkMsg("info", "Orchestrator", "text-violet-400", "none", `Spawned → ${name}`));
          break;
        }

        case "thread_running": {
          const name = String(data.agent_name ?? "");
          const agent = resolveAgent(name);
          if (agent) {
            stateUpdates[agent.id] = "running";
            bump(progressRef.current + 4);
          }
          break;
        }

        case "thread_done": {
          const name = String(data.agent_name ?? "");
          const agent = resolveAgent(name);
          if (agent) {
            stateUpdates[agent.id] = "done";
            detailUpdates[agent.id] = "complete";
            bump(progressRef.current + 7);
          }
          break;
        }

        case "agent_msg_sent": {
          // Orchestrator dispatching task to sub-agent
          const toName = String(data.agent_name ?? "unknown");
          const text = String(data.text ?? "").trim();
          const agent = resolveAgent(toName);
          if (text) {
            newMsgs.push(mkMsg(
              "dispatch",
              "Orchestrator",
              "text-violet-400",
              "out",
              text.length > 300 ? text.slice(0, 300) + "…" : text,
            ));
            if (agent) detailUpdates[agent.id] = text.slice(0, 55);
          }
          break;
        }

        case "agent_msg_received": {
          // Sub-agent reporting back to orchestrator
          const fromName = String(data.agent_name ?? "unknown");
          const text = String(data.text ?? "").trim();
          const agent = resolveAgent(fromName);
          if (text) {
            newMsgs.push(mkMsg(
              "response",
              agent?.shortName ?? fromName,
              agent?.color ?? "text-muted-foreground",
              "in",
              text.length > 300 ? text.slice(0, 300) + "…" : text,
            ));
            if (agent) {
              stateUpdates[agent.id] = "done";
              detailUpdates[agent.id] = text.slice(0, 55);
            }
            bump(progressRef.current + 5);
          }
          break;
        }

        case "agent_thinking": {
          const agentName = String(data.agent_name ?? "Orchestrator");
          const text = String(data.text ?? "").trim();
          const agent = resolveAgent(agentName);
          if (text) {
            newMsgs.push(mkMsg(
              "thinking",
              agent?.shortName ?? agentName,
              agent?.color ?? "text-violet-400",
              "out",
              text.length > 180 ? text.slice(0, 180) + "…" : text,
            ));
          }
          break;
        }

        case "agent_tool_use": {
          const agentName = String(data.agent_name ?? "");
          const toolName = String(data.tool ?? "");
          const preview = String(data.preview ?? "");
          const agent = resolveAgent(agentName);
          if (toolName) {
            newMsgs.push(mkMsg(
              "tool",
              agent?.shortName ?? agentName,
              agent?.color ?? "text-amber-400",
              "out",
              preview || "executing…",
              toolName,
            ));
            if (agent) detailUpdates[agent.id] = `${toolName}${preview ? `: ${preview.slice(0, 40)}` : ""}`;
            bump(progressRef.current + 1);
          }
          break;
        }

        case "orchestrator_message": {
          const text = String(data.text ?? "").trim();
          if (text) {
            detailUpdates["orchestrator"] = text.slice(0, 55);
            newMsgs.push(mkMsg("response", "Orchestrator", "text-violet-400", "in", text.slice(0, 400)));
          }
          break;
        }

        case "leads_found":
          stateUpdates["url-to-leads"] = "done";
          detailUpdates["url-to-leads"] = `${data.count} leads discovered`;
          bump(42);
          newMsgs.push(mkMsg("phase", "Lead Discovery", "text-sky-400", "none", `${data.count} leads found and enriched`));
          break;

        case "sequences_ready":
          bump(88);
          newMsgs.push(mkMsg("phase", "Sequence Writer", "text-primary", "none", `${data.count} sequences complete`));
          break;

        case "error":
          setPhase("failed");
          newMsgs.push(mkMsg("error", "System", "text-destructive", "none", String(data.message ?? "Unknown error").slice(0, 300)));
          break;

        case "queue_warning":
          setQueueWarning(true);
          break;
      }
    }

    if (Object.keys(stateUpdates).length)
      setAgentStates((p) => ({ ...p, ...stateUpdates }));
    if (Object.keys(detailUpdates).length)
      setAgentDetails((p) => ({ ...p, ...detailUpdates }));

    if (newMsgs.length) setMessages((p) => [...p, ...newMsgs].slice(-200));
  }, [events]);

  // Auto-scroll conversation
  useEffect(() => {
    if (convRef.current) convRef.current.scrollTop = convRef.current.scrollHeight;
  }, [messages]);

  // Update active count
  useEffect(() => {
    setActiveCount(Object.values(agentStates).filter((s) => s === "running").length);
  }, [agentStates]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 w-full">

      {/* ── LEFT: Agent pipeline ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">

        {/* Header card */}
        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-primary" />
              <span className="text-xs font-semibold">AmroGen Engine</span>
            </div>
            {isComplete ? (
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                <CheckCircle2 size={12} /> Complete
              </span>
            ) : isFailed ? (
              <span className="text-[11px] text-destructive font-medium">Failed</span>
            ) : (
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.8, repeat: Infinity }}
                className="flex items-center gap-1.5 text-[11px] font-medium text-primary"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Live
              </motion.span>
            )}
          </div>

          <ProgressiveFluxLoader
            value={progress}
            phases={FLUX_PHASES}
            showLabel
            className="max-w-none"
            textClassName="text-xl text-foreground"
            barClassName="h-2.5"
          />
          <p className="text-[11px] text-muted-foreground text-center leading-snug">{currentPhaseLabel}</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 rounded-xl border border-border/50 overflow-hidden bg-card/40">
          {[
            { icon: Users, value: leadsFound, label: "Leads", activeColor: "text-sky-400" },
            { icon: Sparkles, value: seqReady, label: "Seqs", activeColor: "text-primary" },
            { icon: Zap, value: activeCount, label: "Active", activeColor: "text-amber-400" },
          ].map(({ icon: Icon, value, label, activeColor }) => (
            <div key={label} className="flex flex-col items-center py-2.5 gap-0.5 first:border-r last:border-l border-border/40">
              <div className="flex items-center gap-1">
                <Icon size={12} className={value ? activeColor : "text-muted-foreground/30"} />
                <AnimatePresence mode="wait">
                  <motion.span
                    key={value ?? `dash-${label}`}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.25 }}
                    className="text-base font-bold tabular-nums"
                  >
                    {value ?? "—"}
                  </motion.span>
                </AnimatePresence>
              </div>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</span>
            </div>
          ))}
        </div>

        {/* Agent pipeline */}
        <div className="flex flex-col">
          {AGENTS.map((agent, i) => (
            <AgentStep
              key={agent.id}
              agent={agent}
              state={agentStates[agent.id]}
              detail={agentDetails[agent.id]}
              isLast={i === AGENTS.length - 1}
            />
          ))}
        </div>

        {/* Queue warning */}
        <AnimatePresence>
          {queueWarning && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-200">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
                <div>
                  <strong className="text-amber-300">Worker offline.</strong>{" "}
                  Run in terminal:
                  <code className="block mt-1 px-2 py-1 rounded bg-black/40 font-mono text-[10px] text-amber-100 select-all">
                    celery -A app.tasks.celery_app worker
                  </code>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Slow pipeline warning */}
        <AnimatePresence>
          {slowWarning && !queueWarning && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-start gap-2 p-3 rounded-xl border border-sky-500/25 bg-sky-500/8 text-xs text-sky-200">
                <Globe size={14} className="mt-0.5 shrink-0 text-sky-400" />
                <div>
                  <strong className="text-sky-300">Pipeline still running.</strong>{" "}
                  AI agents are working in the background. This page updates live as each step completes.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── RIGHT: Conversation feed ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden flex flex-col">

        {/* Feed header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-card/40 shrink-0">
          <motion.span
            animate={!isComplete && !isFailed ? { opacity: [1, 0.3, 1] } : {}}
            transition={{ duration: 2, repeat: !isComplete && !isFailed ? Infinity : 0 }}
            className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              isComplete ? "bg-emerald-400" : isFailed ? "bg-destructive" : "bg-primary",
            )}
          />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Agent Conversation
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground/40 tabular-nums">
            {messages.length} messages
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-4 py-2 border-b border-border/30 bg-background/20 text-[9px] text-muted-foreground/60 uppercase tracking-wide">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-primary/20 border border-primary/20" />Dispatch</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-secondary border border-border/60" />Response</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-violet-500/10 border border-violet-500/15" />Thinking</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500/10 border border-amber-500/20" />Tool use</span>
        </div>

        {/* Message feed */}
        <div
          ref={convRef}
          className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[400px] max-h-[640px]"
          style={{ scrollBehavior: "smooth" }}
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    animate={{ opacity: [0.15, 0.7, 0.15] }}
                    transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.25 }}
                    className="w-2 h-2 rounded-full bg-primary/40"
                  />
                ))}
              </div>
              <div>
                <p className="text-sm text-muted-foreground/60">
                  {phase === "queued" ? "Waiting for Celery worker…" : "Connecting to agent stream…"}
                </p>
                <p className="text-[11px] text-muted-foreground/30 mt-1">
                  Agent conversations will appear here in real time
                </p>
              </div>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <ConvBubble key={msg.id} msg={msg} />
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border/30 bg-card/40 shrink-0">
          <p className="text-[10px] text-center text-muted-foreground/50">
            5 AI agents coordinate autonomously to research, write, and review your campaign.
          </p>
        </div>
      </div>
    </div>
  );
}
