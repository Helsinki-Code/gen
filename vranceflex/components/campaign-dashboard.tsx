"use client";

import { AlertCircle, ArrowRight, Check, CircleDashed, LoaderCircle, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { campaignStatusLabels, type Campaign } from "../lib/domain/campaign";

const progressStatuses = [
  "researching",
  "enriching",
  "copy_generated",
  "awaiting_approval",
  "scheduled",
  "sent",
  "delivered",
  "replied",
] as const;

export function CampaignDashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const response = await fetch("/api/campaigns", { cache: "no-store" });
      const data = (await response.json()) as { campaigns?: Campaign[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Campaigns could not be loaded.");
      setCampaigns(data.campaigns ?? []);
      setState("ready");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Campaigns could not be loaded.");
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === "loading") {
    return <div className="dashboard-state"><LoaderCircle className="spin" /><h2>Loading campaigns</h2><p>Checking the latest verified campaign state…</p></div>;
  }

  if (state === "error") {
    return <div className="dashboard-state error"><AlertCircle /><h2>Campaigns are unavailable</h2><p>{error}</p><button className="button-secondary" onClick={() => void load()} type="button"><RefreshCw size={16} /> Retry</button></div>;
  }

  if (campaigns.length === 0) {
    return <div className="dashboard-state empty"><span><CircleDashed /></span><h2>No campaigns yet</h2><p>Start with a website or an unlaunched product idea. VranceFlex will turn either into a research plan.</p><a className="button-primary" href="/campaigns/new"><Plus size={17} /> Create your first campaign</a></div>;
  }

  return (
    <>
      <section className="metric-grid">
        <article><span>Active campaigns</span><strong>{campaigns.filter((campaign) => !["replied", "stopped"].includes(campaign.status)).length}</strong><small>Across this workspace</small></article>
        <article><span>Verified leads requested</span><strong>{campaigns.reduce((total, campaign) => total + campaign.leadCount, 0)}</strong><small>Not yet counted as delivered</small></article>
        <article><span>Awaiting approval</span><strong>{campaigns.filter((campaign) => campaign.status === "awaiting_approval").length}</strong><small>Nothing sends automatically</small></article>
      </section>
      <section className="campaign-list">
        <div className="list-heading"><div><span>CAMPAIGNS</span><h2>Live work</h2></div><button aria-label="Refresh campaigns" onClick={() => void load()} type="button"><RefreshCw size={16} /></button></div>
        {campaigns.map((campaign) => {
          const statusIndex = progressStatuses.indexOf(campaign.status as (typeof progressStatuses)[number]);
          return (
            <article className="campaign-row" key={campaign.id}>
              <div className="campaign-identity">
                <span>{campaign.source.kind === "website" ? "URL" : "IDEA"}</span>
                <div><h3>{campaign.productName}</h3><p>{campaign.audience}</p></div>
              </div>
              <div className="status-track" aria-label={`Campaign status: ${campaignStatusLabels[campaign.status]}`}>
                {progressStatuses.slice(0, 4).map((status, index) => <i className={index <= statusIndex ? "complete" : ""} key={status} />)}
              </div>
              <div className={`status-badge status-${campaign.status}`}>{campaignStatusLabels[campaign.status]}</div>
              <div className="campaign-meta"><span>{campaign.leadCount} leads</span><span>{campaign.geography}</span></div>
              <a href={`/dashboard?campaign=${campaign.id}`} aria-label={`Open ${campaign.productName}`}><ArrowRight size={17} /></a>
            </article>
          );
        })}
      </section>
      <div className="truth-banner"><Check size={18} /><p><strong>Truthful by design.</strong> Generated messages never appear as sent. Sent, delivered and replied states require verified provider events.</p></div>
    </>
  );
}
