"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Loader2, Mail, Smartphone } from "lucide-react";
import AuthCard from "@/components/AuthCard";
import { PasswordInput } from "@/components/ui/password-input";
import { isAdminEmail } from "@/lib/admin";
import {
  isMfaChallenge,
  isMfaSetupRequired,
  loginWithPassword,
  sendMfaOtpEmail,
  verifyMfa,
} from "@/lib/auth/api";
import { saveLocalAuth } from "@/lib/auth/local-session";
import { setAuthCookie } from "@/lib/auth/session-cookie";

const fieldCls =
  "h-11 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 text-[14.5px] text-white placeholder:text-white/25 outline-none transition-colors focus:border-primary/70 focus:bg-white/[0.08]";

const labelCls = "mb-1.5 block text-[13px] font-medium text-white/70";

type Step = "credentials" | "mfa";

export default function SignInPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [methods, setMethods] = useState<string[]>([]);
  const [mfaCode, setMfaCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  function completeSession(token: string, email: string, name: string | null | undefined) {
    saveLocalAuth(token, { email, name: name ?? undefined });
    setAuthCookie(token);
    router.replace(isAdminEmail(email) ? "/admin" : "/dashboard");
    router.refresh();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    if (!email || !password) {
      setError("Email and password are required.");
      setIsPending(false);
      return;
    }

    try {
      const data = await loginWithPassword(email, password);
      if (isMfaSetupRequired(data)) {
        router.replace(`/setup-mfa?tempToken=${encodeURIComponent(data.tempToken)}`);
        return;
      }
      if (isMfaChallenge(data)) {
        setTempToken(data.tempToken);
        setMethods(data.methods);
        setStep("mfa");
        setIsPending(false);
        return;
      }
      completeSession(data.token, data.user.email, data.user.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Try again.");
      setIsPending(false);
    }
  }

  async function handleVerifyMfa(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const code = mfaCode.replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setIsPending(true);
    try {
      const data = await verifyMfa(tempToken, code);
      completeSession(data.token, data.user.email, data.user.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid verification code.");
      setIsPending(false);
    }
  }

  async function handleSendEmailOtp() {
    setError("");
    setIsPending(true);
    try {
      await sendMfaOtpEmail(tempToken);
      setOtpSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send email code.");
    }
    setIsPending(false);
  }

  if (step === "mfa") {
    return (
      <AuthCard
        title="Two-factor authentication"
        description="Enter the 6-digit code from your authenticator app or email."
        footer={
          <button
            type="button"
            className="font-medium text-primary hover:text-primary/80 transition-colors"
            onClick={() => {
              setStep("credentials");
              setTempToken("");
              setMethods([]);
              setMfaCode("");
              setOtpSent(false);
              setError("");
            }}
          >
            ← Back to sign in
          </button>
        }
      >
        <form onSubmit={handleVerifyMfa} className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {methods.includes("totp") ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white/70">
                <Smartphone className="h-3.5 w-3.5" /> Authenticator
              </span>
            ) : null}
            {methods.includes("email") ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white/70">
                <Mail className="h-3.5 w-3.5" /> Email
              </span>
            ) : null}
          </div>

          {methods.includes("email") ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => void handleSendEmailOtp()}
              className="text-left text-[13px] text-primary hover:text-primary/80 disabled:opacity-50"
            >
              {otpSent ? "Resend email code" : "Send code to email"}
            </button>
          ) : null}

          <div>
            <label htmlFor="mfa-code" className={labelCls}>Verification code</label>
            <input
              id="mfa-code"
              name="mfa-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className={`${fieldCls} text-center tracking-[0.35em] font-mono`}
            />
          </div>

          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-400 leading-relaxed">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending || mfaCode.replace(/\D/g, "").length < 6}
            className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-[15px] text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {isPending
              ? <><Loader2 size={16} className="animate-spin" /> Verifying…</>
              : <>Verify <ArrowRight size={16} /></>}
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to launch campaigns, review sequences, and manage your AmroGen workspace."
      footer={
        <>
          New to AmroGen?{" "}
          <Link href="/sign-up" className="font-medium text-primary hover:text-primary/80 transition-colors">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className={labelCls}>Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            className={fieldCls}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className={labelCls} style={{ marginBottom: 0 }}>Password</label>
            <Link href="/forgot-password" className="text-[12px] text-white/35 hover:text-white/60 transition-colors">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            name="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className={fieldCls}
          />
        </div>

        {error && (
          <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-400 leading-relaxed">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-[15px] text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
        >
          {isPending
            ? <><Loader2 size={16} className="animate-spin" /> Signing in…</>
            : <>Sign in <ArrowRight size={16} /></>}
        </button>
      </form>
    </AuthCard>
  );
}
