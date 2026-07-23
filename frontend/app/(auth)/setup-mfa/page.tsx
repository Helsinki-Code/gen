"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowRight, Loader2, Mail, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import AuthCard from "@/components/AuthCard";
import { isAdminEmail } from "@/lib/admin";
import { setupMfa, setupMfaVerify } from "@/lib/auth/api";
import { saveLocalAuth } from "@/lib/auth/local-session";
import { setAuthCookie } from "@/lib/auth/session-cookie";

const fieldCls =
  "h-11 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 text-[14.5px] text-white placeholder:text-white/25 outline-none transition-colors focus:border-primary/70 focus:bg-white/[0.08]";

const labelCls = "mb-1.5 block text-[13px] font-medium text-white/70";

function SetupMfaInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tempToken = searchParams.get("tempToken") || "";

  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [totp, setTotp] = useState<{ uri: string; secret: string } | null>(null);
  const [code, setCode] = useState("");

  function completeSession(token: string, email: string, name: string | null | undefined) {
    saveLocalAuth(token, { email, name: name ?? undefined });
    setAuthCookie(token);
    router.replace(isAdminEmail(email) ? "/admin" : "/dashboard");
    router.refresh();
  }

  async function chooseMethod(method: "email" | "totp" | "both") {
    if (!tempToken) {
      setError("Session expired. Please sign in again.");
      return;
    }
    setError("");
    setIsPending(true);
    try {
      const data = await setupMfa(tempToken, method);
      if ("token" in data && data.token) {
        completeSession(data.token, data.user.email, data.user.name);
        return;
      }
      if ("uri" in data && data.uri) {
        setTotp({ uri: data.uri, secret: data.secret });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "MFA setup failed.");
    }
    setIsPending(false);
  }

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = code.replace(/\D/g, "").slice(0, 6);
    if (trimmed.length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setError("");
    setIsPending(true);
    try {
      const data = await setupMfaVerify(tempToken, trimmed);
      completeSession(data.token, data.user.email, data.user.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
      setIsPending(false);
    }
  }

  if (!tempToken) {
    return (
      <AuthCard title="Session expired" description="Please sign in again to set up MFA.">
        <Link href="/sign-in" className="text-primary font-medium hover:text-primary/80">
          ← Back to sign in
        </Link>
      </AuthCard>
    );
  }

  if (totp) {
    return (
      <AuthCard
        title="Scan authenticator QR"
        description="Use Google Authenticator, Authy, or a similar app, then enter the 6-digit code."
      >
        <form onSubmit={handleVerify} className="flex flex-col gap-4">
          <div className="flex justify-center rounded-xl bg-white p-4">
            <QRCodeSVG value={totp.uri} size={200} level="M" />
          </div>
          {totp.secret ? (
            <p className="text-center text-[12px] text-white/45 break-all">
              Manual key: <code className="font-mono text-white/70">{totp.secret}</code>
            </p>
          ) : null}
          <div>
            <label htmlFor="setup-code" className={labelCls}>Verification code</label>
            <input
              id="setup-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className={`${fieldCls} text-center tracking-[0.35em] font-mono`}
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              placeholder="000000"
              required
            />
          </div>
          {error ? (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-400">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={isPending || code.length < 6}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-[15px] text-primary-foreground disabled:opacity-50"
          >
            {isPending ? <><Loader2 size={16} className="animate-spin" /> Verifying…</> : <>Complete setup <ArrowRight size={16} /></>}
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Set up MFA"
      description="Admin accounts require two-factor authentication. Choose a method to continue."
      footer={
        <Link href="/sign-in" className="font-medium text-primary hover:text-primary/80">
          ← Back to sign in
        </Link>
      }
    >
      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() => void chooseMethod("totp")}
          className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-left text-sm text-white hover:bg-white/[0.1] disabled:opacity-50"
        >
          <Smartphone className="h-5 w-5 text-primary" />
          Authenticator app
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => void chooseMethod("email")}
          className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-left text-sm text-white hover:bg-white/[0.1] disabled:opacity-50"
        >
          <Mail className="h-5 w-5 text-primary" />
          Email codes
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => void chooseMethod("both")}
          className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-left text-sm text-white hover:bg-white/[0.1] disabled:opacity-50"
        >
          <Smartphone className="h-5 w-5 text-primary" />
          Both authenticator + email
        </button>
        {error ? (
          <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-400">
            {error}
          </p>
        ) : null}
        {isPending ? (
          <p className="inline-flex items-center gap-2 text-sm text-white/50">
            <Loader2 className="h-4 w-4 animate-spin" /> Preparing…
          </p>
        ) : null}
      </div>
    </AuthCard>
  );
}

export default function SetupMfaPage() {
  return (
    <Suspense fallback={<AuthCard title="Loading…" description="Preparing MFA setup."><Loader2 className="h-5 w-5 animate-spin text-white/50" /></AuthCard>}>
      <SetupMfaInner />
    </Suspense>
  );
}
