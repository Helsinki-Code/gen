"use client";

import {
  TriangleAlert, CircleX, CircleCheck, CircleDashed,
  ScanSearch, Clock5, Flame, Zap, Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CampaignStatusBadgeProps {
  status: string;
  className?: string;
  pulse?: boolean;
}

const STATUS_MAP: Record<string, {
  label: string;
  icon: React.ElementType;
  bg: string;
  text: string;
  border: string;
}> = {
  queued:               { label: "Queued",            icon: Clock5,        bg: "bg-zinc-100 dark:bg-zinc-800",       text: "text-zinc-500",      border: "border-zinc-200 dark:border-zinc-700" },
  generating_leads:     { label: "Finding Leads",      icon: CircleDashed,  bg: "bg-sky-50 dark:bg-sky-900/30",      text: "text-sky-500",        border: "border-sky-200 dark:border-sky-800/50" },
  leads_review:         { label: "Review Leads",       icon: ScanSearch,    bg: "bg-yellow-50 dark:bg-yellow-900/20",text: "text-yellow-600 dark:text-yellow-400",  border: "border-yellow-200 dark:border-yellow-800/50" },
  leads_ready:          { label: "Leads Ready",        icon: CircleCheck,   bg: "bg-sky-50 dark:bg-sky-900/30",      text: "text-sky-500",        border: "border-sky-200 dark:border-sky-800/50" },
  generating_sequences: { label: "Building Sequences", icon: Zap,           bg: "bg-violet-50 dark:bg-violet-900/20",text: "text-violet-500",     border: "border-violet-200 dark:border-violet-800/50" },
  review:               { label: "Review Sequences",   icon: ScanSearch,    bg: "bg-yellow-50 dark:bg-yellow-900/20",text: "text-yellow-600 dark:text-yellow-400",  border: "border-yellow-200 dark:border-yellow-800/50" },
  approved:             { label: "Approved",           icon: CircleCheck,   bg: "bg-emerald-50 dark:bg-emerald-900/20",text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800/50" },
  sending:              { label: "Sending",            icon: Send,          bg: "bg-emerald-50 dark:bg-emerald-900/20",text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800/50" },
  complete:             { label: "Complete",           icon: CircleCheck,   bg: "bg-emerald-50 dark:bg-emerald-900/20",text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800/50" },
  failed:               { label: "Failed",             icon: CircleX,       bg: "bg-rose-50 dark:bg-rose-900/20",    text: "text-rose-500",       border: "border-rose-200 dark:border-rose-800/50" },
  paused:               { label: "Paused",             icon: TriangleAlert, bg: "bg-orange-50 dark:bg-orange-900/20",text: "text-orange-500",     border: "border-orange-200 dark:border-orange-800/50" },
  hot:                  { label: "HOT",                icon: Flame,         bg: "bg-red-50 dark:bg-red-900/20",      text: "text-red-500",        border: "border-red-200 dark:border-red-800/50" },
};

const PULSING = new Set(["generating_leads", "generating_sequences", "leads_ready", "sending"]);

export function CampaignStatusBadge({ status, className, pulse }: CampaignStatusBadgeProps) {
  const cfg = STATUS_MAP[status] ?? {
    label: status,
    icon: CircleDashed,
    bg: "bg-zinc-100 dark:bg-zinc-800",
    text: "text-zinc-500",
    border: "border-zinc-200 dark:border-zinc-700",
  };
  const Icon = cfg.icon;
  const shouldPulse = pulse ?? PULSING.has(status);

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 h-[30px] px-3 rounded-xl border text-xs font-semibold",
      cfg.bg, cfg.text, cfg.border, className
    )}>
      {shouldPulse ? (
        <span className={cn("w-1.5 h-1.5 rounded-full bg-current animate-pulse")} />
      ) : (
        <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
      )}
      {cfg.label}
    </div>
  );
}
