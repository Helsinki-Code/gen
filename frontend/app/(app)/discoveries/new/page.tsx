"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthToken } from "@/lib/auth/use-auth-token";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SIGNAL_OPTIONS = [
  "hiring",
  "funding",
  "expansion",
  "leadership_change",
  "product_launch",
  "partnership",
  "competitor_usage",
  "public_report",
] as const;

const ACCOUNT_OPTIONS = [25, 50, 100, 250, 500, 1000] as const;

function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function NewDiscoveryPage() {
  const getToken = useAuthToken();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [sellerDescription, setSellerDescription] = useState("");
  const [icpDescription, setIcpDescription] = useState("");
  const [industries, setIndustries] = useState("");
  const [geographies, setGeographies] = useState("");
  const [requestedAccounts, setRequestedAccounts] = useState<(typeof ACCOUNT_OPTIONS)[number]>(50);
  const [signals, setSignals] = useState<string[]>(["hiring", "funding"]);

  function toggleSignal(signal: string) {
    setSignals((prev) =>
      prev.includes(signal) ? prev.filter((item) => item !== signal) : [...prev, signal]
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) return;
      const created = (await api.createDiscovery(token, {
        name: name.trim(),
        seller_description: sellerDescription.trim(),
        icp_description: icpDescription.trim(),
        industries: splitList(industries),
        geographies: splitList(geographies),
        requested_accounts: requestedAccounts,
        signals,
      })) as { id: string };
      router.push(`/discoveries/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start discovery");
      setSaving(false);
    }
  }

  const fieldCls =
    "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary";
  const areaCls =
    "min-h-28 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

  return (
    <div className="mx-auto max-w-3xl animate-fade-in px-4 py-8">
      <Button variant="ghost" className="mb-4" onClick={() => router.push("/discoveries")}>
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <Card className="rounded-xl border-border bg-card">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-foreground">New discovery</CardTitle>
          <p className="text-sm text-muted-foreground">
            Describe who you sell to. AmroGen will search for matching accounts and buying signals.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={(e) => void onSubmit(e)}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="name">
                Run name
              </label>
              <input
                id="name"
                className={fieldCls}
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="EU SaaS hiring + funding"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="seller">
                What you sell
              </label>
              <textarea
                id="seller"
                className={areaCls}
                required
                minLength={10}
                value={sellerDescription}
                onChange={(e) => setSellerDescription(e.target.value)}
                placeholder="AI outreach platform for B2B revenue teams…"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="icp">
                Ideal customer profile
              </label>
              <textarea
                id="icp"
                className={areaCls}
                required
                minLength={10}
                value={icpDescription}
                onChange={(e) => setIcpDescription(e.target.value)}
                placeholder="Series A–C B2B SaaS, 50–500 employees, GTM leader owns outbound…"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="industries">
                  Industries (comma-separated)
                </label>
                <input
                  id="industries"
                  className={fieldCls}
                  value={industries}
                  onChange={(e) => setIndustries(e.target.value)}
                  placeholder="SaaS, FinTech"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="geos">
                  Geographies (comma-separated)
                </label>
                <input
                  id="geos"
                  className={fieldCls}
                  value={geographies}
                  onChange={(e) => setGeographies(e.target.value)}
                  placeholder="UK, DACH, Nordics"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="accounts">
                Account target
              </label>
              <select
                id="accounts"
                className={fieldCls}
                value={requestedAccounts}
                onChange={(e) =>
                  setRequestedAccounts(Number(e.target.value) as (typeof ACCOUNT_OPTIONS)[number])
                }
              >
                {ACCOUNT_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} accounts
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Buying signals</p>
              <div className="flex flex-wrap gap-2">
                {SIGNAL_OPTIONS.map((signal) => {
                  const active = signals.includes(signal);
                  return (
                    <Button
                      key={signal}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      onClick={() => toggleSignal(signal)}
                    >
                      {signal.replaceAll("_", " ")}
                    </Button>
                  );
                })}
              </div>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" disabled={saving || signals.length === 0} className="w-full sm:w-auto">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Starting…" : "Start discovery"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
