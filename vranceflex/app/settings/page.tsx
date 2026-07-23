import { CreditCard, KeyRound, PlugZap, ShieldCheck, Users } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { isAuthConfigured } from "../../lib/auth/config";
import { requireWorkspacePage } from "../../lib/auth/page-actor";

export const dynamic = "force-dynamic";

const settings = [
  ["Account", "Profile, password and active sessions", "/settings/account", ShieldCheck],
  ["Team & permissions", "Members, invitations and organization roles", "/settings/team", Users],
  ["Integrations", "Research, email, SMS and reply providers", "/settings/integrations", PlugZap],
  ["Billing", "Plan, usage limits and payment history", "/settings/billing", CreditCard],
  ["API security", "Agent tokens and secure service access", "/settings/security", KeyRound],
] as const;

export default async function SettingsPage() {
  await requireWorkspacePage();

  return (
    <AppShell
      authConfigured={isAuthConfigured()}
      eyebrow="WORKSPACE CONTROL"
      title="Settings"
    >
      <section className="settings-grid">
        {settings.map(([title, description, href, Icon]) => (
          <a href={href} key={title}>
            <span><Icon size={19} /></span>
            <div><h2>{title}</h2><p>{description}</p></div>
          </a>
        ))}
      </section>
      {!isAuthConfigured() && (
        <div className="truth-banner"><ShieldCheck size={18} /><p><strong>Setup mode.</strong> Add Neon, AUTH_SECRET and Resend credentials in the hosting platform before inviting real users.</p></div>
      )}
    </AppShell>
  );
}
