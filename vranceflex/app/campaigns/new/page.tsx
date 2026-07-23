import { CampaignWizard } from "../../../components/campaign-wizard";
import { requireWorkspacePage } from "../../../lib/auth/page-actor";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export const dynamic = "force-dynamic";

export default async function NewCampaignPage({ searchParams }: { searchParams: SearchParams }) {
  await requireWorkspacePage();
  const params = await searchParams;
  const mode = params.mode === "idea" ? "idea" : "website";
  const rawValue = mode === "idea" ? params.idea : params.url;
  const initialValue = typeof rawValue === "string" ? rawValue : "";

  return (
    <main className="wizard-page">
      <nav className="wizard-nav">
        <a className="brand" href="/"><span className="brand-mark">VF</span><span>VranceFlex</span></a>
        <span>New campaign</span>
        <a href="/dashboard">Exit to dashboard</a>
      </nav>
      <CampaignWizard initialMode={mode} initialValue={initialValue} />
      <p className="wizard-footnote">Drafts are private to your workspace. No external action occurs during setup.</p>
    </main>
  );
}
