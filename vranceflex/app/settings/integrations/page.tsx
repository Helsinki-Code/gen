import { ArrowLeft, ShieldCheck } from "lucide-react";
import { AppShell } from "../../../components/app-shell";
import { IntegrationStatusGrid } from "../../../components/integration-status-grid";
import { isAuthConfigured } from "../../../lib/auth/config";
import { requireWorkspacePage } from "../../../lib/auth/page-actor";
import { getIntegrationStatuses } from "../../../lib/server/integration-status";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  await requireWorkspacePage();

  return (
    <AppShell
      authConfigured={isAuthConfigured()}
      eyebrow="WORKSPACE CONTROL"
      title="Integrations"
    >
      <a className="settings-back" href="/settings"><ArrowLeft size={15} /> All settings</a>
      <div className="settings-intro">
        <div><span>PROVIDER READINESS</span><h2>Secrets stay out of the interface.</h2></div>
        <p>This screen only reports whether each hosting variable exists. Secret values are never returned to the browser, logs or agent context.</p>
      </div>
      <IntegrationStatusGrid integrations={getIntegrationStatuses()} />
      <div className="truth-banner"><ShieldCheck size={18} /><p><strong>Fail-closed integrations.</strong> Missing or rejected credentials stop that campaign stage instead of fabricating a successful result.</p></div>
    </AppShell>
  );
}
