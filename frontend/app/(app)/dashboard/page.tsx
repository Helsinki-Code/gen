"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, ArrowUpRight, Loader2, Rocket, Flame, Mail, MessageSquare,
  AlertTriangle, CheckCircle, XCircle, Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { readLocalAuth } from "@/lib/auth/local-session";
import { useAuthToken } from "@/lib/auth/use-auth-token";
import { isAdminEmail } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Counter } from "@/components/ui/animated-counter";
import { CampaignStatusBadge } from "@/components/ui/campaign-status-badge";

interface Campaign {
  id: string;
  target_url: string;
  slug: string;
  leads_requested: number;
  status: string;
  credits_charged: number | null;
  created_at: string;
  leads_count?: number;
  sequences_count?: number;
}

interface InboxItem {
  reply_id: string;
  sequence_id: string | null;
  campaign_id: string | null;
  campaign_url: string | null;
  lead_name: string | null;
  company: string | null;
  intent: string | null;
  body_preview: string | null;
  received_at: string | null;
}

const REVIEW_STATUSES = ["leads_review", "review"];
const RUNNING_STATUSES = ["generating_leads", "leads_ready", "generating_sequences", "sending"];

function formatDomain(url: string) {
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const domain = formatDomain(campaign.target_url);
  const needsReview = REVIEW_STATUSES.includes(campaign.status);
  const isRunning = RUNNING_STATUSES.includes(campaign.status);
  const isFailed = campaign.status === "failed";

  return (
    <Link href={`/campaigns/${campaign.id}`} className="block group">
      <div className="glass-panel rounded-xl p-5 border border-border/60 hover:border-primary/30 transition-all duration-200 hover:bg-secondary/30">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors">
              {domain}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {timeAgo(campaign.created_at)}
            </p>
          </div>
          <CampaignStatusBadge status={campaign.status} />
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
          <span>{campaign.leads_count ?? campaign.leads_requested} leads</span>
        </div>

        {needsReview && (
          <Button size="sm" variant="outline" className="w-full text-amber-400 border-amber-400/30 hover:bg-amber-400/10">
            <AlertTriangle size={13} className="mr-1.5" />
            {campaign.status === "leads_review" ? "Review Leads" : "Review Sequences"}
          </Button>
        )}
        {isRunning && (
          <div className="flex items-center gap-2 text-xs text-blue-400">
            <Loader2 size={12} className="animate-spin" />
            Processing…
          </div>
        )}
        {isFailed && (
          <div className="flex items-center gap-1.5 text-xs text-red-400">
            <XCircle size={12} />
            Failed — click to see error
          </div>
        )}
        {!needsReview && !isRunning && !isFailed && campaign.status !== "queued" && (
          <div className="flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
            View campaign <ArrowUpRight size={11} />
          </div>
        )}
      </div>
    </Link>
  );
}

function PriorityFeed({ hotReplies, campaigns }: { hotReplies: InboxItem[]; campaigns: Campaign[] }) {
  const reviewCampaigns = campaigns.filter(c => REVIEW_STATUSES.includes(c.status));
  const failedCampaigns = campaigns.filter(c => c.status === "failed");

  const isEmpty = hotReplies.length === 0 && reviewCampaigns.length === 0 && failedCampaigns.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground">
        <CheckCircle size={24} className="mb-2 text-emerald-400" />
        <p className="text-sm">All clear — no actions needed</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {hotReplies.map(r => (
        <Link key={r.reply_id} href={r.campaign_id ? `/campaigns/${r.campaign_id}` : "/inbox"}>
          <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer border border-border/40">
            <Flame size={14} className="text-red-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">
                {r.lead_name || "Unknown"} @ {r.company || r.campaign_url || "—"}
              </p>
              {r.body_preview && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">&ldquo;{r.body_preview}&rdquo;</p>
              )}
            </div>
            <span className="text-[10px] text-red-400 font-semibold shrink-0 uppercase">HOT</span>
          </div>
        </Link>
      ))}

      {reviewCampaigns.map(c => (
        <Link key={c.id} href={`/campaigns/${c.id}`}>
          <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer border border-border/40">
            <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{formatDomain(c.target_url)}</p>
              <p className="text-xs text-muted-foreground">
                {c.status === "leads_review" ? "Leads ready for review" : "Sequences ready for review"}
              </p>
            </div>
            <span className="text-[10px] text-amber-400 font-semibold shrink-0 uppercase">Review</span>
          </div>
        </Link>
      ))}

      {failedCampaigns.map(c => (
        <Link key={c.id} href={`/campaigns/${c.id}`}>
          <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer border border-border/40">
            <XCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{formatDomain(c.target_url)}</p>
              <p className="text-xs text-muted-foreground">Pipeline failed</p>
            </div>
            <span className="text-[10px] text-red-400 font-semibold shrink-0 uppercase">Failed</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const getToken = useAuthToken();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [hotReplies, setHotReplies] = useState<InboxItem[]>([]);
  const [inboxCount, setInboxCount] = useState({ total: 0, hot: 0 });
  const [loading, setLoading] = useState(true);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  useEffect(() => {
    const email = readLocalAuth()?.user.email ?? "";
    if (isAdminEmail(email)) {
      router.replace("/admin");
      return;
    }
    setCheckingAdmin(false);
  }, [router]);

  useEffect(() => {
    if (checkingAdmin) return;
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const [camps, balanceData, inboxData, repliesData] = await Promise.all([
          api.getCampaigns(token),
          api.getBalance(token),
          api.getInboxCount(token),
          api.getInbox(token, { intent: "HOT", per_page: 5 }),
        ]);
        setCampaigns(camps as Campaign[]);
        setBalance((balanceData as { balance: number }).balance);
        setInboxCount(inboxData);
        setHotReplies(repliesData as InboxItem[]);
      } catch {}
      setLoading(false);
    })();
  }, [checkingAdmin, getToken]);

  if (checkingAdmin) {
    return (
      <div className="flex min-h-[calc(100vh-1.5rem)] items-center justify-center text-muted-foreground gap-2">
        <Loader2 size={18} className="animate-spin" />
        Opening workspace
      </div>
    );
  }

  const activeCampaigns = campaigns.filter(c =>
    !["complete", "failed", "queued"].includes(c.status)
  );
  const completedCampaigns = campaigns.filter(c => c.status === "complete");

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold tracking-tight glow-text">Command Center</h1>
        <Button asChild>
          <Link href="/campaigns/new">
            <Plus size={16} />
            New Campaign
          </Link>
        </Button>
      </div>

      {/* Pulse Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          {
            label: "Active Campaigns",
            value: loading ? "—" : String(activeCampaigns.length),
            icon: Zap,
            color: "text-blue-400",
          },
          {
            label: "New Replies",
            value: loading ? "—" : String(inboxCount.total),
            icon: MessageSquare,
            color: "text-emerald-400",
          },
          {
            label: "HOT Leads",
            value: loading ? "—" : String(inboxCount.hot),
            icon: Flame,
            color: "text-red-400",
          },
          {
            label: "Credits Left",
            value: loading ? "—" : balance !== null ? String(balance) : "—",
            icon: Mail,
            color: "text-primary",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-panel rounded-xl p-4 border border-border/60">
            <div className="flex items-center gap-2 mb-1">
              <Icon size={14} className={color} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            {loading || value === "—" ? (
              <p className={`text-2xl font-bold ${color}`}>—</p>
            ) : (
              <Counter end={Number(value)} duration={1} fontSize={24} className={color} />
            )}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 size={18} className="animate-spin" />
          Loading…
        </div>
      ) : campaigns.length === 0 ? (
        <div className="max-w-lg mx-auto">
          <Card className="py-16 px-8 text-center glass-panel-elevated">
            <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
              <Rocket size={24} className="text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">No campaigns yet</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Launch your first AI outreach campaign in minutes.
            </p>
            <Button asChild>
              <Link href="/campaigns/new">
                Create your first campaign
                <ArrowUpRight size={16} />
              </Link>
            </Button>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Campaign Cards */}
          <div className="lg:col-span-3 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Campaigns
            </h2>
            {campaigns.map(c => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </div>

          {/* Priority Feed */}
          <div className="lg:col-span-2">
            <div className="glass-panel rounded-xl p-5 border border-border/60 sticky top-4">
              <div className="flex items-center gap-2 mb-4">
                <Flame size={16} className="text-red-400" />
                <h2 className="text-sm font-semibold">Priority Feed</h2>
              </div>
              <PriorityFeed hotReplies={hotReplies} campaigns={campaigns} />

              {(completedCampaigns.length > 0 || inboxCount.total > 0) && (
                <div className="mt-4 pt-4 border-t border-border/40 flex gap-3">
                  <Link href="/inbox" className="flex-1 text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
                    View all replies →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
