"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthToken } from "@/lib/auth/use-auth-token";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type DiscoveryRow = {
  id: string;
  name: string;
  requested_accounts: number;
  discovered_accounts: number;
  total_shards: number;
  completed_shards: number;
  status: string;
  completion_reason: string | null;
  created_at: string;
};

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "success" | "warning" | "destructive"
> = {
  queued: "secondary",
  planning: "default",
  searching: "default",
  scoring: "default",
  completed: "success",
  cancelled: "secondary",
  failed: "destructive",
};

export default function DiscoveriesPage() {
  const getToken = useAuthToken();
  const router = useRouter();
  const [rows, setRows] = useState<DiscoveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) return;
      const data = (await api.getDiscoveries(token)) as DiscoveryRow[];
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load discoveries");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="mx-auto max-w-5xl animate-fade-in p-6 lg:p-8">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Discoveries</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Find ICP-fit accounts from buying signals, then launch campaigns from selected domains.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => router.push("/discoveries/new")}>
            <Plus className="h-4 w-4" />
            New discovery
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading discoveries…
        </div>
      ) : null}

      {!loading && error ? (
        <Card className="border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">{error}</Card>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
            <Search className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">No discovery runs yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Start a discovery to find accounts that match your ICP and buying signals.
            </p>
          </div>
          <Button onClick={() => router.push("/discoveries/new")}>
            <Plus className="h-4 w-4" />
            New discovery
          </Button>
        </div>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card
              key={row.id}
              className="cursor-pointer rounded-xl border-border bg-card transition-colors hover:border-primary/40"
              onClick={() => router.push(`/discoveries/${row.id}`)}
            >
              <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-semibold text-foreground">{row.name}</h2>
                    <Badge variant={STATUS_VARIANT[row.status] || "secondary"}>{row.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {row.discovered_accounts}/{row.requested_accounts} accounts · shards{" "}
                    {row.completed_shards}/{row.total_shards} ·{" "}
                    {new Date(row.created_at).toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/discoveries/${row.id}`);
                  }}
                >
                  Open
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
