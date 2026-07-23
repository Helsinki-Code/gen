import { CircleDashed } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { IcpReport } from "../../components/icp-report";
import { isAuthConfigured } from "../../lib/auth/config";
import { requireWorkspacePage } from "../../lib/auth/page-actor";
import { getApiActor } from "../../lib/server/api-actor";
import { getIcpProfile } from "../../lib/server/lead-store";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata = { title: "ICP report · VranceFlex" };
export const dynamic = "force-dynamic";

export default async function IcpPage({ searchParams }: { searchParams: SearchParams }) {
  await requireWorkspacePage();
  const params = await searchParams;
  const campaignId =
    typeof params.campaign === "string" ? params.campaign : undefined;
  const actor = await getApiActor();
  const profile = await getIcpProfile(actor, campaignId);

  return (
    <AppShell
      activeHref="/leads"
      authConfigured={isAuthConfigured()}
      eyebrow="RESEARCH WORKSPACE"
      title="ICP report"
    >
      {profile ? (
        <IcpReport profile={profile} />
      ) : (
        <section className="lead-state empty standalone">
          <CircleDashed />
          <h2>No ICP report yet</h2>
          <p>The report appears after market research has produced enough supporting evidence.</p>
          <a className="button-primary" href="/leads">Return to leads</a>
        </section>
      )}
    </AppShell>
  );
}
