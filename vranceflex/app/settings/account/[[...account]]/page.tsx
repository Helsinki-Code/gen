import { ArrowLeft } from "lucide-react";
import { AccountSettingsForm } from "../../../../components/account-settings-form";
import { AppShell } from "../../../../components/app-shell";
import { isAuthConfigured } from "../../../../lib/auth/config";
import { requireWorkspacePage } from "../../../../lib/auth/page-actor";

export const metadata = { title: "Account settings · VranceFlex" };
export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const actor = await requireWorkspacePage();

  return (
    <AppShell
      activeHref="/settings"
      authConfigured={isAuthConfigured()}
      eyebrow="WORKSPACE CONTROL"
      title="Account"
    >
      <a className="settings-back" href="/settings">
        <ArrowLeft size={15} /> All settings
      </a>
      <AccountSettingsForm
        email={actor.email}
        name={actor.name ?? actor.email.split("@")[0]}
      />
    </AppShell>
  );
}
