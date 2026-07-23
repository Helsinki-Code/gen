"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import AuthLayout from "@/components/ui/smart-hover-auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { isAdminEmail } from "@/lib/admin";
import { isMfaChallenge, isMfaSetupRequired, requestPasswordReset, resetPassword } from "@/lib/auth/api";
import { saveLocalAuth } from "@/lib/auth/local-session";
import { setAuthCookie } from "@/lib/auth/session-cookie";

type Step = "email" | "otp" | "newpassword" | "done";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  async function handleEmailSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setIsPending(true);
    const val = String(new FormData(e.currentTarget).get("email") || "").trim();
    try {
      await requestPasswordReset(val);
      setEmail(val);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset code. Try again.");
    }
    setIsPending(false);
  }

  async function handleOtpSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const val = String(new FormData(e.currentTarget).get("otp") || "").trim();
    if (val.length !== 6) { setError("Enter the 6-digit code from your email."); return; }
    setOtp(val);
    setStep("newpassword");
  }

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") || "");
    const confirm = String(fd.get("confirm") || "");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setIsPending(true);
    try {
      const data = await resetPassword(email, otp, password);
      if (isMfaSetupRequired(data)) {
        router.replace(`/setup-mfa?tempToken=${encodeURIComponent(data.tempToken)}`);
        return;
      }
      if (isMfaChallenge(data)) {
        router.replace("/sign-in");
        return;
      }
      saveLocalAuth(data.token, { email: data.user.email, name: data.user.name ?? undefined });
      setAuthCookie(data.token);
      setStep("done");
      setTimeout(() => router.replace(isAdminEmail(email) ? "/admin" : "/dashboard"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code. Try again.");
    }
    setIsPending(false);
  }

  if (step === "done") {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-4">
          <div className="mb-2 text-center">
            <h2 className="text-3xl font-black text-neutral-900 dark:text-white mb-2 tracking-tight">
              Password updated!
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400 font-medium text-sm">
              Signing you in now…
            </p>
          </div>
          <div className="flex flex-col items-center gap-5 py-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/15">
              <CheckCircle2 size={28} className="text-orange-500" />
            </div>
            <Link href="/sign-in" className="text-sm font-bold text-orange-500 hover:underline">
              Go to sign in →
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  if (step === "email") {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-4">
          <div className="mb-2 text-center">
            <h2 className="text-3xl font-black text-neutral-900 dark:text-white mb-2 tracking-tight">
              Reset password
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400 font-medium text-sm">
              Enter your email and we&apos;ll send a 6-digit reset code.
            </p>
          </div>
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Email Address
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                className="w-full rounded-xl border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50"
              />
            </div>
            {error && (
              <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
            <Button
              type="submit"
              disabled={isPending}
              className="w-full py-6 mt-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black text-base transition-all shadow-[0_8px_30px_rgb(249,115,22,0.3)] hover:shadow-[0_8px_30px_rgb(249,115,22,0.5)] hover:-translate-y-0.5 border-0"
              size="lg"
            >
              {isPending ? (
                <><Loader2 size={17} className="animate-spin" /> Sending…</>
              ) : (
                <>Send reset code <ArrowRight size={17} /></>
              )}
            </Button>
          </form>
          <p className="text-center text-sm font-medium text-neutral-500 dark:text-neutral-400 mt-2">
            <Link href="/sign-in" className="text-orange-500 font-bold hover:underline">
              ← Back to sign in
            </Link>
          </p>
        </div>
      </AuthLayout>
    );
  }

  if (step === "otp") {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-4">
          <div className="mb-2 text-center">
            <h2 className="text-3xl font-black text-neutral-900 dark:text-white mb-2 tracking-tight">
              Check your inbox
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400 font-medium text-sm">
              We sent a 6-digit code to {email}.
            </p>
          </div>
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div>
              <Label htmlFor="otp" className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                6-digit code
              </Label>
              <Input
                id="otp"
                name="otp"
                type="text"
                inputMode="numeric"
                required
                maxLength={6}
                placeholder="123456"
                className="w-full rounded-xl border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-center tracking-[0.4em] text-lg font-mono"
              />
            </div>
            {error && (
              <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
            <Button
              type="submit"
              className="w-full py-6 mt-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black text-base transition-all shadow-[0_8px_30px_rgb(249,115,22,0.3)] hover:shadow-[0_8px_30px_rgb(249,115,22,0.5)] hover:-translate-y-0.5 border-0"
              size="lg"
            >
              Verify code <ArrowRight size={17} />
            </Button>
          </form>
          <p className="text-center text-sm font-medium text-neutral-500 dark:text-neutral-400 mt-2">
            <button
              type="button"
              onClick={() => { setStep("email"); setError(""); }}
              className="text-orange-500 font-bold hover:underline"
            >
              ← Use a different email
            </button>
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="flex flex-col gap-4">
        <div className="mb-2 text-center">
          <h2 className="text-3xl font-black text-neutral-900 dark:text-white mb-2 tracking-tight">
            Set new password
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 font-medium text-sm">
            Choose a strong password for your account.
          </p>
        </div>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <Label htmlFor="password" className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-1">
              New password
            </Label>
            <PasswordInput
              id="password"
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Minimum 8 characters"
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-3 h-10"
            />
          </div>
          <div>
            <Label htmlFor="confirm" className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-1">
              Confirm password
            </Label>
            <PasswordInput
              id="confirm"
              name="confirm"
              required
              autoComplete="new-password"
              placeholder="Re-enter new password"
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-3 h-10"
            />
          </div>
          {error && (
            <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
          <Button
            type="submit"
            disabled={isPending}
            className="w-full py-6 mt-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black text-base transition-all shadow-[0_8px_30px_rgb(249,115,22,0.3)] hover:shadow-[0_8px_30px_rgb(249,115,22,0.5)] hover:-translate-y-0.5 border-0"
            size="lg"
          >
            {isPending ? (
              <><Loader2 size={17} className="animate-spin" /> Updating…</>
            ) : (
              <>Set new password <ArrowRight size={17} /></>
            )}
          </Button>
        </form>
        <p className="text-center text-sm font-medium text-neutral-500 dark:text-neutral-400 mt-2">
          <button
            type="button"
            onClick={() => { setStep("otp"); setError(""); }}
            className="text-orange-500 font-bold hover:underline"
          >
            ← Back to code entry
          </button>
        </p>
      </div>
    </AuthLayout>
  );
}
