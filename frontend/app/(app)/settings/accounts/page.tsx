"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, XCircle, Mail, MessageSquare, Send, ArrowUpRight, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthToken } from "@/lib/auth/use-auth-token";
import { cn } from "@/lib/utils";

interface ConnectionStatus {
  gmail: { connected: boolean; email: string | null };
  resend: { connected: boolean; from_email: string | null; from_name: string | null };
  twilio: { connected: boolean; from_number: string | null };
}

function ConnectionCard({
  name,
  icon: Icon,
  connected,
  detail,
  href,
  note,
}: {
  name: string;
  icon: React.ElementType;
  connected: boolean;
  detail: string | null;
  href: string;
  note?: string;
}) {
  return (
    <div className={cn(
      "flex items-center gap-4 p-4 rounded-xl border transition-colors",
      connected
        ? "border-emerald-400/20 bg-emerald-400/5"
        : "border-border/60 bg-secondary/20"
    )}>
      <div className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center border",
        connected ? "bg-emerald-400/10 border-emerald-400/25" : "bg-secondary border-border"
      )}>
        <Icon size={18} className={connected ? "text-emerald-400" : "text-muted-foreground"} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{name}</span>
          {connected
            ? <CheckCircle size={14} className="text-emerald-400" />
            : <XCircle size={14} className="text-muted-foreground" />}
        </div>
        {detail ? (
          <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
        ) : (
          <p className="text-xs text-muted-foreground mt-0.5">Not connected</p>
        )}
        {note && !connected && (
          <p className="text-xs text-amber-400/80 mt-0.5">{note}</p>
        )}
      </div>

      <Link href={href} className="shrink-0">
        <button className={cn(
          "text-xs px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5",
          connected
            ? "border-border hover:bg-secondary/60 text-muted-foreground"
            : "border-primary/30 text-primary hover:bg-primary/10"
        )}>
          {connected ? "Manage" : "Connect"}
          <ArrowUpRight size={11} />
        </button>
      </Link>
    </div>
  );
}

export default function AccountsPage() {
  const getToken = useAuthToken();
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const [gmail, resend, twilio] = await Promise.all([
          api.getGmailStatus(token),
          api.getResendStatus(token),
          api.getTwilioStatus(token),
        ]);
        setStatus({
          gmail:  { connected: gmail.connected, email: gmail.gmail_email },
          resend: { connected: resend.connected, from_email: resend.from_email, from_name: resend.from_name },
          twilio: { connected: twilio.connected, from_number: twilio.from_number },
        });
      } catch {}
      setLoading(false);
    })();
  }, [getToken]);

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center text-muted-foreground gap-2">
        <Loader2 size={16} className="animate-spin" />
        Loading…
      </div>
    );
  }

  const s = status;
  const emailConnected = s?.gmail.connected || s?.resend.connected;

  return (
    <div className="p-5 lg:p-7 max-w-2xl mx-auto animate-fade-in">
      <h1 className="text-xl font-bold mb-1">Connected Accounts</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Connect senders AmroGen can use on your behalf. Email is required to launch;
        SMS is optional — connect Twilio whenever you want SMS available.
      </p>

      {/* Email senders */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Email Sender
        </h2>
        <div className="space-y-3">
          <ConnectionCard
            name="Gmail"
            icon={Mail}
            connected={s?.gmail.connected ?? false}
            detail={s?.gmail.email ?? null}
            href="/settings/gmail"
          />
          <ConnectionCard
            name="Resend"
            icon={Send}
            connected={s?.resend.connected ?? false}
            detail={
              s?.resend.from_email
                ? s?.resend.from_name
                  ? `${s.resend.from_name} <${s.resend.from_email}>`
                  : s.resend.from_email
                : null
            }
            href="/settings/resend"
          />
          {(s?.gmail.connected && s?.resend.connected) && (
            <p className="text-xs text-muted-foreground px-1">
              Priority: Resend (used when both are connected)
            </p>
          )}
          {!emailConnected && (
            <p className="text-xs text-red-400 px-1">
              Connect at least one email sender to launch campaigns.
            </p>
          )}
        </div>
      </section>

      {/* SMS sender */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          SMS Sender
        </h2>
        <ConnectionCard
          name="Twilio"
          icon={MessageSquare}
          connected={s?.twilio.connected ?? false}
          detail={s?.twilio.from_number ?? null}
          href="/settings/twilio"
          note="SMS channel is always available in AmroGen. Connect Twilio to send; if disconnected, SMS steps are skipped."
        />
      </section>
    </div>
  );
}
