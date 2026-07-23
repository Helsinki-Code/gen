"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import AuthCard from "@/components/AuthCard";
import { PasswordInput } from "@/components/ui/password-input";
import { isAdminEmail } from "@/lib/admin";
import { isMfaChallenge, isMfaSetupRequired, registerWithPassword } from "@/lib/auth/api";
import { saveLocalAuth } from "@/lib/auth/local-session";
import { setAuthCookie } from "@/lib/auth/session-cookie";

const fieldCls =
  "h-11 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 text-[14.5px] text-white placeholder:text-white/25 outline-none transition-colors focus:border-primary/70 focus:bg-white/[0.08]";

const labelCls = "mb-1.5 block text-[13px] font-medium text-white/70";

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    if (!name || !email || !password) {
      setError("Name, email, and password are required.");
      setIsPending(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setIsPending(false);
      return;
    }

    try {
      const data = await registerWithPassword(name, email, password);
      if (isMfaSetupRequired(data)) {
        router.replace(`/setup-mfa?tempToken=${encodeURIComponent(data.tempToken)}`);
        return;
      }
      if (isMfaChallenge(data)) {
        router.replace(`/sign-in`);
        return;
      }
      saveLocalAuth(data.token, {
        email: data.user.email,
        name: data.user.name ?? name,
      });
      setAuthCookie(data.token);
      router.replace(isAdminEmail(email) ? "/admin" : "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create your account.");
      setIsPending(false);
    }
  }

  return (
    <AuthCard
      title="Create your AmroGen workspace"
      description="Start with one company URL, generate reviewed outreach, and approve what deserves to go out."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/sign-in" className="font-medium text-primary hover:text-primary/80 transition-colors">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="name" className={labelCls}>Name</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder="Alex Morgan"
            className={fieldCls}
          />
        </div>

        <div>
          <label htmlFor="email" className={labelCls}>Work email</label>
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
          <label htmlFor="password" className={labelCls}>Password</label>
          <PasswordInput
            id="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Minimum 8 characters"
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
            ? <><Loader2 size={16} className="animate-spin" /> Creating workspace…</>
            : <>Create account <ArrowRight size={16} /></>}
        </button>
      </form>
    </AuthCard>
  );
}
