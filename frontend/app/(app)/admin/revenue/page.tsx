"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CreditCard,
  Loader2,
  ReceiptText,
  RefreshCw,
  Wallet,
} from "lucide-react";
import AdminGuard from "@/components/AdminGuard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAuthToken } from "@/lib/auth/use-auth-token";

type RevenueResponse = {
  credit_price_cents: number;
  metrics: {
    credits_purchased: number;
    credits_spent: number;
    outstanding_credits: number;
    transaction_count: number;
    estimated_revenue_cents: number;
    estimated_usage_value_cents: number;
    outstanding_credit_value_cents: number;
  };
  flow_by_day: Array<{
    date: string;
    credits_purchased: number;
    credits_spent: number;
    net_credits: number;
  }>;
  top_customers: Array<{
    email: string;
    name: string | null;
    credit_balance: number;
    credits_purchased: number;
    credits_spent: number;
    estimated_value_cents: number;
  }>;
  recent_transactions: Array<{
    id: string;
    user_email: string;
    amount: number;
    type: string;
    description: string | null;
    stripe_payment_intent_id: string | null;
    created_at: string;
    estimated_value_cents: number;
  }>;
};

export default function AdminRevenuePage() {
  return (
    <AdminGuard>
      <AdminRevenue />
    </AdminGuard>
  );
}

function AdminRevenue() {
  const getToken = useAuthToken();
  const [data, setData] = useState<RevenueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  async function loadRevenue() {
    setError("");
    try {
      const token = await getToken();
      if (!token) return;
      setLoading(true);
      setData((await api.getAdminRevenue(token)) as RevenueResponse);
      setUpdatedAt(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load revenue data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRevenue();
  }, []);

  const maxFlow = useMemo(() => {
    if (!data?.flow_by_day.length) return 1;
    return Math.max(
      1,
      ...data.flow_by_day.map((day) => Math.max(day.credits_purchased, day.credits_spent))
    );
  }, [data]);

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8 animate-fade-in">
      <div className="mb-7 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-primary">
            <CreditCard size={16} />
            Revenue management
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Revenue & Credits</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Live credit purchase, usage, outstanding balance, and customer value reporting from the app ledger.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {updatedAt && <Badge variant="secondary">Updated {updatedAt.toLocaleTimeString()}</Badge>}
          <Button variant="secondary" onClick={loadRevenue} disabled={loading}>
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

      {loading && !data ? (
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 size={18} className="animate-spin" />
          Loading revenue data
        </div>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Estimated Revenue"
              value={formatMoney(data?.metrics.estimated_revenue_cents || 0)}
              detail={`${(data?.metrics.credits_purchased || 0).toLocaleString()} credits purchased`}
              icon={ArrowUpRight}
            />
            <MetricCard
              label="Usage Value"
              value={formatMoney(data?.metrics.estimated_usage_value_cents || 0)}
              detail={`${(data?.metrics.credits_spent || 0).toLocaleString()} credits consumed`}
              icon={ArrowDownRight}
            />
            <MetricCard
              label="Outstanding Credits"
              value={(data?.metrics.outstanding_credits || 0).toLocaleString()}
              detail={`${formatMoney(data?.metrics.outstanding_credit_value_cents || 0)} remaining value`}
              icon={Wallet}
            />
            <MetricCard
              label="Ledger Entries"
              value={(data?.metrics.transaction_count || 0).toLocaleString()}
              detail={`${formatMoney(data?.credit_price_cents || 0)} per credit setting`}
              icon={ReceiptText}
            />
          </div>

          <div className="mb-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <Card elevated>
              <CardHeader>
                <CardTitle>30-Day Credit Flow</CardTitle>
                <CardDescription>Purchased vs consumed credits, grouped by transaction day.</CardDescription>
              </CardHeader>
              <CardContent>
                {data?.flow_by_day.length ? (
                  <div className="space-y-3">
                    {data.flow_by_day.map((day) => (
                      <div key={day.date} className="grid gap-2 md:grid-cols-[110px_1fr_90px] md:items-center">
                        <div className="text-xs text-muted-foreground">{formatShortDate(day.date)}</div>
                        <div className="space-y-1.5">
                          <FlowBar value={day.credits_purchased} max={maxFlow} className="bg-primary" />
                          <FlowBar value={day.credits_spent} max={maxFlow} className="bg-sky-400" />
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          Net {day.net_credits.toLocaleString()}
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-4 pt-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-5 rounded-full bg-primary" />
                        Purchased
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-5 rounded-full bg-sky-400" />
                        Consumed
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="py-16 text-center text-sm text-muted-foreground">No credit movement in the last 30 days.</p>
                )}
              </CardContent>
            </Card>

            <Card elevated>
              <CardHeader>
                <CardTitle>Top Customers</CardTitle>
                <CardDescription>Ranked by purchased credit value.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data?.top_customers.length ? (
                  data.top_customers.map((customer, index) => (
                    <div key={customer.email} className="rounded-lg border border-border bg-secondary/30 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{customer.email}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {customer.name || "No name"} · {customer.credit_balance.toLocaleString()} credits left
                          </div>
                        </div>
                        <Badge variant={index < 3 ? "default" : "secondary"}>
                          {formatMoney(customer.estimated_value_cents)}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>Purchased {customer.credits_purchased.toLocaleString()}</span>
                        <span>Spent {customer.credits_spent.toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-16 text-center text-sm text-muted-foreground">No paying customers yet.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Ledger Activity</CardTitle>
              <CardDescription>Latest purchases, credits, and pipeline usage events.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-3 font-medium">Customer</th>
                      <th className="px-3 py-3 font-medium">Type</th>
                      <th className="px-3 py-3 font-medium">Amount</th>
                      <th className="px-3 py-3 font-medium">Value</th>
                      <th className="px-3 py-3 font-medium">Description</th>
                      <th className="px-3 py-3 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data?.recent_transactions.length ? (
                      data.recent_transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-secondary/25">
                          <td className="px-3 py-4 font-medium">{tx.user_email}</td>
                          <td className="px-3 py-4">
                            <Badge variant={tx.amount > 0 ? "success" : "secondary"}>
                              {tx.type.replace(/_/g, " ")}
                            </Badge>
                          </td>
                          <td className={tx.amount > 0 ? "px-3 py-4 text-primary" : "px-3 py-4 text-sky-400"}>
                            {tx.amount > 0 ? "+" : ""}
                            {tx.amount.toLocaleString()}
                          </td>
                          <td className="px-3 py-4">{formatMoney(tx.estimated_value_cents)}</td>
                          <td className="px-3 py-4 text-muted-foreground">{tx.description || "No description"}</td>
                          <td className="px-3 py-4 text-xs text-muted-foreground">
                            {new Date(tx.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-3 py-16 text-center text-sm text-muted-foreground">
                          No ledger entries yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof BarChart3;
}) {
  return (
    <Card elevated className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
          <Icon size={19} />
        </div>
      </div>
    </Card>
  );
}

function FlowBar({ value, max, className }: { value: number; max: number; className: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-secondary">
      <div className={`h-full rounded-full ${className}`} style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
    </div>
  );
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
