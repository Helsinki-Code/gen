import { ArrowLeft, Check, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { AppShell } from "../../../components/app-shell";
import { isAuthConfigured } from "../../../lib/auth/config";
import { requireWorkspacePage } from "../../../lib/auth/page-actor";
import { hasDatabaseConfiguration } from "../../../lib/server/database";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  await requireWorkspacePage();
  const checks = [
    ["VranceFlex identity", isAuthConfigured(), "Neon users, sessions and active organizations"],
    ["PostgreSQL persistence", hasDatabaseConfiguration(), "Durable tenant-scoped product data"],
    ["Eve bearer verification", isAuthConfigured(), "Opaque session verified before organization scope is stamped"],
    ["Email OTP delivery", Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL), "Short-lived signup and recovery codes"],
  ] as const;

  return (
    <AppShell
      authConfigured={isAuthConfigured()}
      eyebrow="WORKSPACE CONTROL"
      title="API security"
    >
      <a className="settings-back" href="/settings"><ArrowLeft size={15} /> All settings</a>
      <section className="security-panel">
        <div className="security-copy"><span><KeyRound size={21} /></span><h2>Identity at every boundary.</h2><p>VranceFlex derives user and organization scope from verified sessions—not from form fields, prompts or URLs.</p></div>
        <div className="security-checks">
          {checks.map(([name, ready, description]) => (
            <article key={name}>
              <span className={ready ? "ready" : ""}>{ready ? <Check size={15} /> : <LockKeyhole size={15} />}</span>
              <div><strong>{name}</strong><small>{description}</small></div>
              <em>{ready ? "Ready" : "Configure"}</em>
            </article>
          ))}
        </div>
      </section>
      <div className="truth-banner"><ShieldCheck size={18} /><p><strong>Tenant isolation.</strong> Campaign reads and writes use the organization ID from a verified VranceFlex session stored in Neon.</p></div>
    </AppShell>
  );
}
