"use client";

import {
  ArrowRight,
  Check,
  KeyRound,
  LoaderCircle,
  Mail,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

async function authRequest<T>(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T & {
    error?: string;
    issues?: Array<{ message: string }>;
  };
  if (!response.ok) {
    throw new Error(
      data.error ??
        data.issues?.[0]?.message ??
        "The request could not be completed.",
    );
  }
  return data;
}

function SubmitButton({
  busy,
  children,
}: {
  busy: boolean;
  children: React.ReactNode;
}) {
  return (
    <button className="auth-submit" disabled={busy} type="submit">
      {busy ? <LoaderCircle className="spin" size={17} /> : children}
    </button>
  );
}

function ErrorMessage({ error }: { error: string }) {
  return error ? (
    <div className="auth-form-error" role="alert">
      {error}
    </div>
  ) : null;
}

export function SignInForm({ nextPath = "/dashboard" }: { nextPath?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await authRequest("/api/auth/signin", {
        email: form.get("email"),
        password: form.get("password"),
      });
      router.push(nextPath.startsWith("/") ? nextPath : "/dashboard");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Sign in could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="first-party-auth-form" onSubmit={submit}>
      <div className="auth-form-heading">
        <span><ShieldCheck size={15} /> Secure workspace access</span>
        <h2>Welcome back</h2>
        <p>Sign in to your VranceFlex workspace.</p>
      </div>
      <ErrorMessage error={error} />
      <label>
        <span>Email address</span>
        <input autoComplete="email" name="email" required type="email" />
      </label>
      <label>
        <span>Password</span>
        <input autoComplete="current-password" name="password" required type="password" />
      </label>
      <div className="auth-form-row">
        <a href="/forgot-password">Forgot password?</a>
      </div>
      <SubmitButton busy={busy}>
        Sign in <ArrowRight size={16} />
      </SubmitButton>
      <p className="auth-form-switch">
        New to VranceFlex? <a href="/sign-up">Create an account</a>
      </p>
    </form>
  );
}

export function SignUpFlow() {
  const router = useRouter();
  const [stage, setStage] = useState<"details" | "verify">("details");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resent, setResent] = useState(false);

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const submittedEmail = String(form.get("email") ?? "");
    try {
      await authRequest("/api/auth/signup", {
        name: form.get("name"),
        organizationName: form.get("organizationName"),
        email: submittedEmail,
        password: form.get("password"),
      });
      setEmail(submittedEmail);
      setStage("verify");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Your account could not be created.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await authRequest("/api/auth/verify", {
        email,
        code: form.get("code"),
      });
      router.push("/dashboard");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The code could not be verified.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError("");
    setResent(false);
    try {
      await authRequest("/api/auth/resend", { email });
      setResent(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "A new code could not be sent.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (stage === "verify") {
    return (
      <form className="first-party-auth-form" onSubmit={verify}>
        <div className="auth-form-heading">
          <span><Mail size={15} /> Email verification</span>
          <h2>Check your inbox</h2>
          <p>Enter the six-digit code sent to <strong>{email}</strong>.</p>
        </div>
        <ErrorMessage error={error} />
        {resent && (
          <div className="auth-form-success"><Check size={15} /> A new code was sent.</div>
        )}
        <label>
          <span>Verification code</span>
          <input
            autoComplete="one-time-code"
            className="otp-input"
            inputMode="numeric"
            maxLength={6}
            name="code"
            pattern="\d{6}"
            required
          />
        </label>
        <SubmitButton busy={busy}>
          Verify and continue <ArrowRight size={16} />
        </SubmitButton>
        <button
          className="auth-text-button"
          disabled={busy}
          onClick={() => void resend()}
          type="button"
        >
          <RefreshCw size={14} /> Send another code
        </button>
      </form>
    );
  }

  return (
    <form className="first-party-auth-form" onSubmit={createAccount}>
      <div className="auth-form-heading">
        <span><ShieldCheck size={15} /> Verified signup</span>
        <h2>Create your workspace</h2>
        <p>Your account stays pending until the email OTP is confirmed.</p>
      </div>
      <ErrorMessage error={error} />
      <div className="auth-field-grid">
        <label>
          <span>Your name</span>
          <input autoComplete="name" name="name" required />
        </label>
        <label>
          <span>Workspace name</span>
          <input autoComplete="organization" name="organizationName" required />
        </label>
      </div>
      <label>
        <span>Work email</span>
        <input autoComplete="email" name="email" required type="email" />
      </label>
      <label>
        <span>Password</span>
        <input
          autoComplete="new-password"
          minLength={10}
          name="password"
          required
          type="password"
        />
        <small>At least 10 characters with a letter and number.</small>
      </label>
      <SubmitButton busy={busy}>
        Send verification code <ArrowRight size={16} />
      </SubmitButton>
      <p className="auth-form-switch">
        Already have an account? <a href="/sign-in">Sign in</a>
      </p>
    </form>
  );
}

export function ForgotPasswordFlow() {
  const [stage, setStage] = useState<"request" | "reset" | "complete">("request");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const submittedEmail = String(form.get("email") ?? "");
    try {
      await authRequest("/api/auth/forgot-password", {
        email: submittedEmail,
      });
      setEmail(submittedEmail);
      setStage("reset");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The reset request could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function completeReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await authRequest("/api/auth/reset-password", {
        email,
        code: form.get("code"),
        password: form.get("password"),
      });
      setStage("complete");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The password could not be reset.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (stage === "complete") {
    return (
      <div className="first-party-auth-form auth-complete">
        <span><Check size={21} /></span>
        <h2>Password updated</h2>
        <p>Your previous sessions were revoked. Sign in again with your new password.</p>
        <a className="auth-submit" href="/sign-in">Return to sign in <ArrowRight size={16} /></a>
      </div>
    );
  }

  if (stage === "reset") {
    return (
      <form className="first-party-auth-form" onSubmit={completeReset}>
        <div className="auth-form-heading">
          <span><KeyRound size={15} /> Password recovery</span>
          <h2>Choose a new password</h2>
          <p>If an account exists, a six-digit code was sent to {email}.</p>
        </div>
        <ErrorMessage error={error} />
        <label>
          <span>Reset code</span>
          <input
            autoComplete="one-time-code"
            className="otp-input"
            inputMode="numeric"
            maxLength={6}
            name="code"
            pattern="\d{6}"
            required
          />
        </label>
        <label>
          <span>New password</span>
          <input autoComplete="new-password" minLength={10} name="password" required type="password" />
        </label>
        <SubmitButton busy={busy}>
          Reset password <ArrowRight size={16} />
        </SubmitButton>
      </form>
    );
  }

  return (
    <form className="first-party-auth-form" onSubmit={requestCode}>
      <div className="auth-form-heading">
        <span><KeyRound size={15} /> Password recovery</span>
        <h2>Recover your account</h2>
        <p>We’ll email a short-lived reset code if the account exists.</p>
      </div>
      <ErrorMessage error={error} />
      <label>
        <span>Email address</span>
        <input autoComplete="email" name="email" required type="email" />
      </label>
      <SubmitButton busy={busy}>
        Send reset code <ArrowRight size={16} />
      </SubmitButton>
      <p className="auth-form-switch"><a href="/sign-in">Return to sign in</a></p>
    </form>
  );
}
