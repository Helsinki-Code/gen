import { ArrowLeft, Check, CreditCard, ShieldCheck } from "lucide-react";
import { AppShell } from "../../../components/app-shell";
import { isAuthConfigured } from "../../../lib/auth/config";
import { requireWorkspacePage } from "../../../lib/auth/page-actor";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  await requireWorkspacePage();
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY?.trim());

  return (
    <AppShell
      authConfigured={isAuthConfigured()}
      eyebrow="WORKSPACE CONTROL"
      title="Billing"
    >
      <a className="settings-back" href="/settings"><ArrowLeft size={15} /> All settings</a>
      <div className="billing-layout">
        <section className="plan-card">
          <span className="section-label">CURRENT PLAN</span>
          <h2>{stripeConfigured ? "Workspace plan" : "Setup mode"}</h2>
          <p>{stripeConfigured ? "Billing is connected for this deployment." : "Stripe is not connected. No customer can be charged."}</p>
          <ul>
            <li><Check size={15} /> Organization-scoped usage ledger</li>
            <li><Check size={15} /> Idempotent billing event keys</li>
            <li><Check size={15} /> Lead and channel limits ready</li>
          </ul>
        </section>
        <section className="billing-safety">
          <span><CreditCard size={22} /></span>
          <h2>Billing actions remain disabled.</h2>
          <p>Checkout, subscription changes and invoices will activate only after Stripe webhooks and production plan IDs are configured.</p>
          <div><ShieldCheck size={16} /> Repeated provider events cannot create repeated usage entries.</div>
        </section>
      </div>
    </AppShell>
  );
}
