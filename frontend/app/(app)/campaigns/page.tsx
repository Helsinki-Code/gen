"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  XCircle,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthToken } from "@/lib/auth/use-auth-token";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Campaign {
  id: string;
  target_url: string;
  status: string;
  leads_requested: number;
  credits_charged: number;
  created_at: string;
  error_message: string | null;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  queued: "secondary",
  generating_leads: "default",
  leads_ready: "default",
  generating_sequences: "default",
  review: "warning",
  approved: "warning",
  sending: "default",
  complete: "success",
  failed: "destructive",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  complete: <CheckCircle2 size={14} />,
  failed: <XCircle size={14} />,
  review: <Clock size={14} />,
  approved: <Clock size={14} />,
};

function StatusIcon({ status }: { status: string }) {
  const icon = STATUS_ICON[status];
  if (!icon) return <Zap size={14} />;
  return <>{icon}</>;
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function CampaignsPage() {
  const getToken = useAuthToken();
  const router = useRouter();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) return;
      const data = (await api.getCampaigns(token)) as Campaign[];
      setCampaigns(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const active = campaigns.filter((c) =>
    ["queued", "generating_leads", "leads_ready", "generating_sequences"].includes(c.status)
  );
  const review = campaigns.filter((c) => ["review", "approved"].includes(c.status));
  const done = campaigns.filter((c) => ["complete", "failed", "sending"].includes(c.status));

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your AI-powered outreach campaigns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={cn(loading && "animate-spin")} />
            Refresh
          </Button>
          <Button onClick={() => router.push("/campaigns/new")}>
            <Plus size={16} />
            New Campaign
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground text-sm">
          <Loader2 size={18} className="animate-spin" />
          Loading campaigns…
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <Card className="border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
          {error}
        </Card>
      )}

      {/* Empty state */}
      {!loading && !error && campaigns.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Zap size={24} className="text-primary" />
          </div>
          <div>
            <p className="font-semibold text-lg">No campaigns yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first campaign to start generating leads and sequences.
            </p>
          </div>
          <Button onClick={() => router.push("/campaigns/new")}>
            <Plus size={16} />
            Create Campaign
          </Button>
        </div>
      )}

      {/* Campaign groups */}
      {!loading && !error && campaigns.length > 0 && (
        <div className="space-y-8">
          {active.length > 0 && (
            <Section title="Running" count={active.length}>
              {active.map((c) => (
                <CampaignRow key={c.id} campaign={c} onClick={() => router.push(`/campaigns/${c.id}`)} />
              ))}
            </Section>
          )}

          {review.length > 0 && (
            <Section title="Awaiting Review" count={review.length}>
              {review.map((c) => (
                <CampaignRow key={c.id} campaign={c} onClick={() => router.push(`/campaigns/${c.id}`)} />
              ))}
            </Section>
          )}

          {done.length > 0 && (
            <Section title="Completed" count={done.length}>
              {done.map((c) => (
                <CampaignRow key={c.id} campaign={c} onClick={() => router.push(`/campaigns/${c.id}`)} />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
          {title}
        </h2>
        <span className="text-xs bg-secondary border border-border px-2 py-0.5 rounded-full text-muted-foreground">
          {count}
        </span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function CampaignRow({ campaign, onClick }: { campaign: Campaign; onClick: () => void }) {
  const isRunning = ["queued", "generating_leads", "leads_ready", "generating_sequences"].includes(
    campaign.status
  );

  return (
    <Card
      className="group cursor-pointer hover:border-primary/30 transition-all duration-200"
      onClick={onClick}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-4 px-5 py-4">
          {/* Status dot */}
          <div
            className={cn(
              "w-2 h-2 rounded-full shrink-0",
              isRunning && "bg-primary animate-pulse",
              campaign.status === "review" || campaign.status === "approved"
                ? "bg-yellow-500"
                : "",
              campaign.status === "complete" ? "bg-green-500" : "",
              campaign.status === "failed" ? "bg-destructive" : "",
              campaign.status === "sending" ? "bg-primary animate-pulse" : ""
            )}
          />

          {/* URL + meta */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{getDomain(campaign.target_url)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {campaign.leads_requested} leads · {campaign.credits_charged ?? "—"} credits ·{" "}
              {new Date(campaign.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>

          {/* Status badge */}
          <Badge
            variant={STATUS_VARIANT[campaign.status] ?? "secondary"}
            className="shrink-0 gap-1"
          >
            <StatusIcon status={campaign.status} />
            {campaign.status.replace(/_/g, " ")}
          </Badge>

          {/* Arrow */}
          <ArrowRight
            size={16}
            className="text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-150 shrink-0"
          />
        </div>

        {campaign.error_message && (
          <div className="px-5 pb-3 text-xs text-destructive border-t border-destructive/10 pt-2 bg-destructive/5">
            {campaign.error_message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
