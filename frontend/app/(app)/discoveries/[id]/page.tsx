"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthToken } from "@/lib/auth/use-auth-token";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DiscoveryRun = {
  id: string;
  name: string;
  status: string;
  requested_accounts: number;
  discovered_accounts: number;
  total_shards: number;
  completed_shards: number;
  error_message: string | null;
  completion_reason: string | null;
  created_at: string;
};

type ProspectAccount = {
  id: string;
  name: string;
  normalized_domain: string;
  website_url: string;
  industry: string | null;
  location: string | null;
  composite_score: number;
  status: string;
  score_rationale: string;
};

type AccountsPage = {
  items: ProspectAccount[];
  page: number;
  per_page: number;
  total: number;
  pages: number;
};

const ACTIVE = new Set(["queued", "planning", "searching", "scoring"]);

export default function DiscoveryDetailPage() {
  const params = useParams();
  const id = String(params.id || "");
  const getToken = useAuthToken();
  const router = useRouter();

  const [run, setRun] = useState<DiscoveryRun | null>(null);
  const [accounts, setAccounts] = useState<AccountsPage | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const token = await getToken();
      if (!token) return;
      const [runData, accountData] = await Promise.all([
        api.getDiscovery(token, id) as Promise<DiscoveryRun>,
        api.getDiscoveryAccounts(token, id, { per_page: 50, min_score: 0 }) as Promise<AccountsPage>,
      ]);
      setRun(runData);
      setAccounts(accountData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load discovery");
    } finally {
      setLoading(false);
    }
  }, [getToken, id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!run || !ACTIVE.has(run.status)) return;
    const timer = window.setInterval(() => {
      void load();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [load, run?.status]);

  function toggle(accountId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  }

  async function cancelRun() {
    setBusy(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) return;
      await api.cancelDiscovery(token, id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setBusy(false);
    }
  }

  async function markSelected() {
    if (!selected.size) return;
    setBusy(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) return;
      await api.bulkSelectDiscoveryAccounts(token, id, {
        account_ids: [...selected],
        status: "selected",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Select failed");
    } finally {
      setBusy(false);
    }
  }

  async function launchSelected() {
    if (!selected.size) return;
    const ok = window.confirm(
      `Launch campaigns for ${selected.size} selected account(s)? Credits will be reserved.`
    );
    if (!ok) return;
    setBusy(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) return;
      await api.bulkLaunchDiscovery(token, id, {
        account_ids: [...selected],
        leads_per_account: 10,
        batch_size: 5,
        confirm_large_launch: selected.size > 25,
      });
      router.push("/campaigns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Launch failed");
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading discovery…
      </div>
    );
  }

  if (!run) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <p className="text-sm text-destructive">{error || "Discovery not found"}</p>
        <Button className="mt-4" variant="outline" onClick={() => router.push("/discoveries")}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl animate-fade-in space-y-6 p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" className="mb-2 px-0" onClick={() => router.push("/discoveries")}>
            <ArrowLeft className="h-4 w-4" />
            Discoveries
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">{run.name}</h1>
            <Badge>{run.status}</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {run.discovered_accounts}/{run.requested_accounts} accounts · shards{" "}
            {run.completed_shards}/{run.total_shards}
            {run.completion_reason ? ` · ${run.completion_reason}` : ""}
          </p>
          {run.error_message ? (
            <p className="mt-2 text-sm text-destructive">{run.error_message}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={busy}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          {ACTIVE.has(run.status) ? (
            <Button variant="destructive" size="sm" disabled={busy} onClick={() => void cancelRun()}>
              Cancel
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            disabled={busy || selected.size === 0}
            onClick={() => void markSelected()}
          >
            Mark selected ({selected.size})
          </Button>
          <Button size="sm" disabled={busy || selected.size === 0} onClick={() => void launchSelected()}>
            Launch campaigns
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card className="rounded-xl border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            Accounts {accounts ? `(${accounts.total})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!accounts?.items.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {ACTIVE.has(run.status)
                ? "Still searching — accounts will appear here as scoring completes."
                : "No accounts in this run yet."}
            </p>
          ) : (
            accounts.items.map((account) => {
              const checked = selected.has(account.id);
              return (
                <label
                  key={account.id}
                  className="flex cursor-pointer gap-3 rounded-lg border border-border p-4 hover:border-primary/40"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    onChange={() => toggle(account.id)}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{account.name}</span>
                      <Badge variant="secondary">{account.status}</Badge>
                      <span className="text-xs text-muted-foreground">score {account.composite_score}</span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {account.normalized_domain}
                      {account.industry ? ` · ${account.industry}` : ""}
                      {account.location ? ` · ${account.location}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{account.score_rationale}</p>
                  </div>
                </label>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
