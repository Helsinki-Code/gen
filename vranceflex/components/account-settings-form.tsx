"use client";

import { Check, LoaderCircle, Save } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AccountSettingsForm({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.get("name") }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Profile could not be updated.");
      setSaved(true);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Profile could not be updated.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="account-settings-card" onSubmit={submit}>
      <div>
        <span>PROFILE</span>
        <h2>Your identity</h2>
        <p>Used for workspace activity, approvals and audit history.</p>
      </div>
      {error && <div className="auth-form-error" role="alert">{error}</div>}
      {saved && <div className="auth-form-success"><Check size={15} /> Profile updated.</div>}
      <label>
        <span>Display name</span>
        <input defaultValue={name} name="name" required />
      </label>
      <label>
        <span>Verified email</span>
        <input disabled value={email} />
      </label>
      <button className="button-primary" disabled={busy} type="submit">
        {busy ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
        Save profile
      </button>
      <a href="/forgot-password">Reset password and revoke active sessions</a>
    </form>
  );
}
