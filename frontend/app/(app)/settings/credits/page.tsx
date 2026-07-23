"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Coins, Loader2, Check, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthToken } from "@/lib/auth/use-auth-token";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import TiltCard from "@/components/TiltCard";
import { cn } from "@/lib/utils";
import {
  SUBSCRIPTION_PLANS,
  formatPlanPrice,
  STRIPE_CHECKOUT_PLAN_IDS,
  type SubscriptionPlanId,
} from "@/lib/pricing-plans";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

const PLANS = SUBSCRIPTION_PLANS.map((plan) => ({
  id: plan.id,
  name: plan.name,
  price: formatPlanPrice(plan.pricePerCampaign),
  period: "/campaign",
  packNote: `10-pack ${formatPlanPrice(plan.packPrice)} (${plan.packDiscountPercent}% off ${formatPlanPrice(plan.packListPrice)})`,
  creditsNote: `${plan.creditsPerCampaign} credits per campaign`,
  popular: plan.popular,
}));

function CreditsPageContent() {
  const getToken = useAuthToken();
  const searchParams = useSearchParams();
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(
    null
  );
  const [confirming, setConfirming] = useState(false);
  const confirmedSessionRef = useRef<string | null>(null);

  const loadBalance = async () => {
    const token = await getToken();
    if (!token) return;
    const data = (await api.getBalance(token)) as { balance: number; transactions: Transaction[] };
    setBalance(data.balance);
    setTransactions(data.transactions);
  };

  useEffect(() => {
    void loadBalance();
  }, []);

  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    const sessionId = searchParams.get("session_id");

    if (canceled === "1") {
      setStatusMessage({ type: "info", text: "Checkout canceled — no charge was made." });
      return;
    }

    if (success === "1" && sessionId && confirmedSessionRef.current !== sessionId) {
      confirmedSessionRef.current = sessionId;
      setConfirming(true);
      void (async () => {
        try {
          const token = await getToken();
          if (!token) return;
          await api.confirmCreditsSession(token, sessionId);
          setStatusMessage({ type: "success", text: "Payment confirmed — credits added to your balance." });
          await loadBalance();
        } catch {
          setStatusMessage({
            type: "error",
            text: "Payment received but confirmation is still processing. Refresh in a moment.",
          });
        } finally {
          setConfirming(false);
        }
      })();
    }
  }, [searchParams, getToken]);

  const handlePurchase = async (planId: SubscriptionPlanId) => {
    setPurchasing(planId);
    try {
      const token = await getToken();
      if (!token) return;
      const stripePlan = STRIPE_CHECKOUT_PLAN_IDS[planId];
      const result = (await api.purchaseCredits(token, stripePlan)) as { checkout_url: string };
      window.location.href = result.checkout_url;
    } catch {
      setStatusMessage({ type: "error", text: "Could not start checkout. Try again." });
      setPurchasing(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Coins className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Credits</h1>
          <p className="text-sm text-muted-foreground">
            Balance: {balance === null ? "…" : balance} credits
          </p>
        </div>
      </div>

      {statusMessage && (
        <Card className="mb-6 p-4">
          <div className="flex items-start gap-2 text-sm">
            {statusMessage.type === "success" && <Check className="h-4 w-4 text-primary mt-0.5" />}
            {statusMessage.type === "error" && <X className="h-4 w-4 text-destructive mt-0.5" />}
            <p className="text-foreground">{statusMessage.text}</p>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-4 mb-12">
        {PLANS.map((plan) => (
          <TiltCard key={plan.id}>
            <Card
              elevated={plan.popular}
              className={cn(
                "h-full flex flex-col p-6",
                plan.popular && "border-primary/30"
              )}
            >
              {plan.popular && (
                <Badge variant="default" className="self-start mb-3">Most popular</Badge>
              )}
              <h3 className="font-semibold text-lg">{plan.name}</h3>
              <div className="mt-2 mb-1">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground text-sm">{plan.period}</span>
              </div>
              <p className="text-sm text-muted-foreground">{plan.creditsNote}</p>
              <p className="text-xs text-muted-foreground mb-6">{plan.packNote}</p>
              <Button
                className="w-full mt-auto"
                variant={plan.popular ? "default" : "secondary"}
                onClick={() => void handlePurchase(plan.id)}
                disabled={purchasing === plan.id || confirming}
              >
                {purchasing === plan.id ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Redirecting…
                  </>
                ) : (
                  "Buy pack"
                )}
              </Button>
            </Card>
          </TiltCard>
        ))}
      </div>

      <h2 className="font-semibold mb-4">Transaction History</h2>
      {transactions.length === 0 ? (
        <p className="text-muted-foreground text-sm">No transactions yet.</p>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <Card key={tx.id} className="p-4 flex justify-between text-sm">
              <div>
                <p className="font-medium">{tx.description ?? tx.type}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(tx.created_at).toLocaleString()}
                </p>
              </div>
              <span className={cn("font-semibold", tx.amount > 0 ? "text-primary" : "text-muted-foreground")}>
                {tx.amount > 0 ? "+" : ""}
                {tx.amount}
              </span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CreditsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading…</div>}>
      <CreditsPageContent />
    </Suspense>
  );
}
