"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Coins,
  KeyRound,
  Loader2,
  Mic2,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import AdminGuard from "@/components/AdminGuard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthToken } from "@/lib/auth/use-auth-token";

type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  credit_balance: number;
  created_at: string;
  updated_at: string;
  campaign_count: number;
  leads_requested: number;
  credits_charged: number;
  credits_purchased: number;
  credits_spent: number;
  transaction_count: number;
  api_key_count: number;
  active_api_key_count: number;
  podcast_count: number;
  last_campaign_at: string | null;
  last_transaction_at: string | null;
  last_api_key_used_at: string | null;
  last_podcast_at: string | null;
};

type AdminUsersResponse = {
  summary: {
    shown_users: number;
    credit_balance: number;
    campaigns: number;
    credits_purchased: number;
    credits_spent: number;
  };
  users: AdminUserRow[];
};

export default function AdminUsersPage() {
  return (
    <AdminGuard>
      <AdminUsers />
    </AdminGuard>
  );
}

function AdminUsers() {
  const getToken = useAuthToken();
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  async function loadUsers(search = appliedQuery) {
    setError("");
    try {
      const token = await getToken();
      if (!token) return;
      setLoading(true);
      setData((await api.getAdminUsers(token, search)) as AdminUsersResponse);
      setUpdatedAt(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers("");
  }, []);

  const activeUsers = useMemo(() => {
    if (!data) return 0;
    return data.users.filter(
      (user) => user.campaign_count > 0 || user.api_key_count > 0 || user.podcast_count > 0
    ).length;
  }, [data]);

  const handleSearch = () => {
    const nextQuery = query.trim();
    setAppliedQuery(nextQuery);
    loadUsers(nextQuery);
  };

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8 animate-fade-in">
      <div className="mb-7 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-primary">
            <Users size={16} />
            User management
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Search accounts, monitor balances, and review campaign, API, and podcast activity from live database records.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {updatedAt && (
            <Badge variant="secondary">Updated {updatedAt.toLocaleTimeString()}</Badge>
          )}
          <Button variant="secondary" onClick={() => loadUsers()} disabled={loading}>
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

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Visible Users" value={data?.summary.shown_users || 0} icon={Users} />
        <MetricCard label="Active Users" value={activeUsers} icon={ShieldCheck} />
        <MetricCard label="Credit Balance" value={data?.summary.credit_balance || 0} icon={Coins} />
        <MetricCard label="Campaigns" value={data?.summary.campaigns || 0} icon={Activity} />
      </div>

      <Card elevated>
        <CardHeader className="gap-4 xl:flex-row xl:items-end xl:justify-between xl:space-y-0">
          <div>
            <CardTitle>Account Directory</CardTitle>
            <CardDescription>
              Admin-only account view with usage, balances, and key production indicators.
            </CardDescription>
          </div>
          <div className="flex w-full gap-2 xl:w-[420px]">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSearch();
              }}
              placeholder="Search by email"
            />
            <Button onClick={handleSearch} disabled={loading}>
              <Search size={16} />
              Search
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
              <Loader2 size={18} className="animate-spin" />
              Loading users
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 font-medium">User</th>
                    <th className="px-3 py-3 font-medium">Balance</th>
                    <th className="px-3 py-3 font-medium">Credits</th>
                    <th className="px-3 py-3 font-medium">Campaigns</th>
                    <th className="px-3 py-3 font-medium">API Keys</th>
                    <th className="px-3 py-3 font-medium">Podcasts</th>
                    <th className="px-3 py-3 font-medium">Last Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data?.users.length ? (
                    data.users.map((user) => (
                      <tr key={user.id} className="align-top hover:bg-secondary/25">
                        <td className="px-3 py-4">
                          <div className="font-medium text-foreground">{user.email}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {user.name || "No name"} · Joined {formatDate(user.created_at)}
                          </div>
                        </td>
                        <td className="px-3 py-4 font-semibold">{user.credit_balance.toLocaleString()}</td>
                        <td className="px-3 py-4">
                          <div className="text-xs text-muted-foreground">Purchased {user.credits_purchased.toLocaleString()}</div>
                          <div className="mt-1 text-xs text-muted-foreground">Spent {user.credits_spent.toLocaleString()}</div>
                        </td>
                        <td className="px-3 py-4">
                          <Badge variant={user.campaign_count ? "default" : "secondary"}>
                            {user.campaign_count.toLocaleString()} campaigns
                          </Badge>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {user.leads_requested.toLocaleString()} leads requested
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-2 text-xs">
                            <KeyRound size={14} className="text-primary" />
                            {user.active_api_key_count}/{user.api_key_count} active
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-2 text-xs">
                            <Mic2 size={14} className="text-primary" />
                            {user.podcast_count.toLocaleString()} episodes
                          </div>
                        </td>
                        <td className="px-3 py-4 text-xs text-muted-foreground">
                          {latestDate([
                            user.last_campaign_at,
                            user.last_transaction_at,
                            user.last_api_key_used_at,
                            user.last_podcast_at,
                          ])}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-3 py-16 text-center text-sm text-muted-foreground">
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
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

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function latestDate(values: Array<string | null>) {
  const dates = values.filter(Boolean).map((value) => new Date(value as string).getTime());
  if (!dates.length) return "No activity yet";
  return new Date(Math.max(...dates)).toLocaleString();
}
