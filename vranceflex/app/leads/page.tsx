import { AppShell } from "../../components/app-shell";
import { LeadsWorkspace } from "../../components/leads-workspace";
import { isAuthConfigured } from "../../lib/auth/config";
import { requireWorkspacePage } from "../../lib/auth/page-actor";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata = { title: "Leads · VranceFlex" };
export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireWorkspacePage();
  const params = await searchParams;
  const campaignId =
    typeof params.campaign === "string" ? params.campaign : undefined;

  return (
    <AppShell
      activeHref="/leads"
      authConfigured={isAuthConfigured()}
      eyebrow="RESEARCH WORKSPACE"
      title="Leads"
    >
      <LeadsWorkspace campaignId={campaignId} />
    </AppShell>
  );
}
