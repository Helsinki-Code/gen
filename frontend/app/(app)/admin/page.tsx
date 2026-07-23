"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Clock,
  CreditCard,
  FileText,
  Loader2,
  Mic2,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import AdminGuard from "@/components/AdminGuard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAuthToken } from "@/lib/auth/use-auth-token";

type Overview = {
  metrics: Record<string, number>;
  campaign_statuses: Record<string, number>;
  sequence_statuses: Record<string, number>;
  podcast_statuses: Record<string, number>;
  recent_campaigns: Array<{
    id: string;
    user_email: string;
    target_url: string;
    leads_requested: number;
    status: string;
    credits_charged: number | null;
    created_at: string;
    completed_at: string | null;
  }>;
  recent_episodes: Array<{
    id: string;
    user_email: string;
    title: string;
    status: string;
    source_type: string;
    duration_minutes: number;
    created_at: string;
    published_at: string | null;
  }>;
};

type ArticleSummary = {
  count: number;
  posts: Array<{
    slug: string;
    title: string;
    wordCount: number;
    imageCount: number;
    faqCount: number;
  }>;
  generatedAt: string;
};

export default function AdminPage() {
  return (
    <AdminGuard>
      <AdminDashboard />
    </AdminGuard>
  );
}

function AdminDashboard() {
  const getToken = useAuthToken();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [articles, setArticles] = useState<ArticleSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  async function loadDashboard() {
    setError("");
    try {
      const token = await getToken();
      if (!token) return;
      const [overviewData, articleResponse] = await Promise.all([
        api.getAdminOverview(token) as Promise<Overview>,
        fetch("/api/admin/articles", { cache: "no-store" }),
      ]);
      if (!articleResponse.ok) throw new Error("Unable to load article inventory");
      setOverview(overviewData);
      setArticles((await articleResponse.json()) as ArticleSummary);
      setUpdatedAt(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load admin dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    const interval = window.setInterval(loadDashboard, 30000);
    return () => window.clearInterval(interval);
  }, []);

  const articleHealth = useMemo(() => {
    if (!articles?.posts.length) return { avgWords: 0, missingImages: 0, faqReady: 0 };
    return {
      avgWords: Math.round(
        articles.posts.reduce((sum, post) => sum + post.wordCount, 0) / articles.posts.length
      ),
      missingImages: articles.posts.filter((post) => post.imageCount === 0).length,
      faqReady: articles.posts.filter((post) => post.faqCount > 0).length,
    };
  }, [articles]);

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8 animate-fade-in">
      <div className="mb-7 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-primary">
            <ShieldCheck size={16} />
            Admin control center
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Live operational view for campaigns, credits, content, and podcast production.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {updatedAt && (
            <Badge variant="secondary" className="gap-1.5">
              <Clock size={12} />
              Updated {updatedAt.toLocaleTimeString()}
            </Badge>
          )}
          <Button variant="secondary" onClick={loadDashboard} disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && !overview ? (
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground gap-2">
          <Loader2 size={18} className="animate-spin" />
          Loading live admin data
        </div>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Users" value={overview?.metrics.users || 0} icon={Users} />
            <MetricCard label="Campaigns" value={overview?.metrics.campaigns || 0} icon={Activity} />
            <MetricCard label="Leads" value={overview?.metrics.leads || 0} icon={ArrowUpRight} />
            <MetricCard label="Podcast Episodes" value={overview?.metrics.podcast_episodes || 0} icon={Mic2} />
          </div>

          <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <AdminActionCard
              href="/admin/users"
              title="User Management"
              description="Review accounts, balances, API keys, campaigns, and podcast activity."
              icon={Users}
            />
            <AdminActionCard
              href="/admin/revenue"
              title="Revenue Management"
              description="Track credit purchases, usage value, outstanding balances, and customer value."
              icon={CreditCard}
            />
            <AdminActionCard
              href="/admin/articles"
              title="Article Management"
              description="Generate, improve, approve, publish, and package SEO articles."
              icon={FileText}
            />
            <AdminActionCard
              href="/podcast-studio"
              title="Podcast Studio"
              description="Create, generate audio, publish, and monitor AmroGen podcasts."
              icon={Mic2}
            />
          </div>

          <div className="mb-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <Card elevated>
              <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardTitle>Operational Status</CardTitle>
                  <CardDescription>Campaign, sequence, and podcast status distribution.</CardDescription>
                </div>
                <Badge variant="default">Live DB</Badge>
              </CardHeader>
              <CardContent className="grid gap-5 lg:grid-cols-3">
                <StatusPanel title="Campaigns" data={overview?.campaign_statuses || {}} />
                <StatusPanel title="Sequences" data={overview?.sequence_statuses || {}} />
                <StatusPanel title="Podcasts" data={overview?.podcast_statuses || {}} />
              </CardContent>
            </Card>

            <Card elevated>
              <CardHeader>
                <CardTitle>Content Operations</CardTitle>
                <CardDescription>Markdown-backed article inventory from docs/latest.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ContentRow label="Published articles" value={articles?.count || 0} />
                <ContentRow label="Average words" value={articleHealth.avgWords} />
                <ContentRow label="FAQ-ready posts" value={articleHealth.faqReady} />
                <ContentRow label="Missing images" value={articleHealth.missingImages} tone={articleHealth.missingImages ? "warn" : "good"} />
                <Button asChild className="mt-2 w-full">
                  <Link href="/admin/articles">
                    <FileText size={16} />
                    Manage Articles
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <RecentCampaigns campaigns={overview?.recent_campaigns || []} />
            <RecentEpisodes episodes={overview?.recent_episodes || []} />
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return (
    <Card elevated className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{value.toLocaleString()}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
          <Icon size={19} />
        </div>
      </div>
    </Card>
  );
}

function AdminActionCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: typeof Users;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-border bg-card/70 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-secondary/45"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
          <Icon size={19} />
        </div>
        <ArrowUpRight size={16} className="text-muted-foreground transition-colors group-hover:text-primary" />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </Link>
  );
}

function StatusPanel({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className="space-y-3">
        {entries.length === 0 ? (
          <p className="rounded-lg border border-border bg-secondary/30 px-3 py-4 text-sm text-muted-foreground">
            No data yet
          </p>
        ) : (
          entries.map(([status, count]) => (
            <div key={status}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="capitalize text-muted-foreground">{status.replace(/_/g, " ")}</span>
                <span className="font-medium">{count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(8, Math.round((count / total) * 100))}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ContentRow({ label, value, tone }: { label: string; value: number; tone?: "good" | "warn" }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/35 px-3 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={tone === "warn" ? "font-semibold text-amber-500" : "font-semibold text-foreground"}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}

function RecentCampaigns({ campaigns }: { campaigns: Overview["recent_campaigns"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Campaigns</CardTitle>
        <CardDescription>Newest campaign activity across the application.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {campaigns.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No campaigns yet</p>
          ) : (
            campaigns.map((campaign) => (
              <div key={campaign.id} className="rounded-lg border border-border bg-secondary/30 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{campaign.target_url}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{campaign.user_email}</p>
                  </div>
                  <Badge variant="secondary">{campaign.status.replace(/_/g, " ")}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>{campaign.leads_requested} leads</span>
                  <span>{campaign.credits_charged ?? 0} credits</span>
                  <span>{new Date(campaign.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RecentEpisodes({ episodes }: { episodes: Overview["recent_episodes"] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Podcast Studio</CardTitle>
          <CardDescription>Latest episode production states.</CardDescription>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href="/podcast-studio">
            Open
            <ArrowUpRight size={14} />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {episodes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No podcast episodes yet</p>
          ) : (
            episodes.map((episode) => (
              <div key={episode.id} className="rounded-lg border border-border bg-secondary/30 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{episode.title}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{episode.user_email}</p>
                  </div>
                  <Badge variant="secondary">{episode.status.replace(/_/g, " ")}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>{episode.source_type.replace(/_/g, " ")}</span>
                  <span>{episode.duration_minutes} min</span>
                  <span>{new Date(episode.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
