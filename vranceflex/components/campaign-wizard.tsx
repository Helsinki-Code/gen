"use client";

import { ArrowLeft, ArrowRight, Check, Globe2, Lightbulb, LoaderCircle } from "lucide-react";
import { useMemo, useState } from "react";
import type { CampaignCreateInput } from "../lib/domain/campaign";

type Mode = "website" | "idea";
type FormState = {
  businessName: string;
  productName: string;
  productSummary: string;
  websiteUrl: string;
  ideaName: string;
  ideaDescription: string;
  ideaStage: "concept" | "prototype" | "mvp" | "launched";
  audience: string;
  geography: string;
  goal: CampaignCreateInput["goal"];
  leadCount: CampaignCreateInput["leadCount"];
  monthlyBudgetUsd: number;
  channels: Array<"email" | "sms">;
};

const initialForm: FormState = {
  businessName: "",
  productName: "",
  productSummary: "",
  websiteUrl: "",
  ideaName: "",
  ideaDescription: "",
  ideaStage: "concept",
  audience: "",
  geography: "",
  goal: "book_meetings",
  leadCount: 25,
  monthlyBudgetUsd: 500,
  channels: ["email"],
};

const stepNames = ["Product", "Audience", "Campaign"];

export function CampaignWizard({
  initialMode = "website",
  initialValue = "",
}: {
  initialMode?: Mode;
  initialValue?: string;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({
    ...initialForm,
    websiteUrl: initialMode === "website" ? initialValue : "",
    ideaDescription: initialMode === "idea" ? initialValue : "",
  });
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [campaignId, setCampaignId] = useState("");

  const canContinue = useMemo(() => {
    if (step === 0) {
      const sourceReady =
        mode === "website"
          ? /^https?:\/\/.+/i.test(form.websiteUrl)
          : form.ideaName.trim().length >= 2 && form.ideaDescription.trim().length >= 30;
      return (
        sourceReady &&
        form.businessName.trim().length >= 2 &&
        form.productName.trim().length >= 2 &&
        form.productSummary.trim().length >= 30
      );
    }
    if (step === 1) return form.audience.trim().length >= 10 && form.geography.trim().length >= 2;
    return form.channels.length > 0 && form.monthlyBudgetUsd >= 100;
  }, [form, mode, step]);

  function update<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleChannel(channel: "email" | "sms") {
    update(
      "channels",
      form.channels.includes(channel)
        ? form.channels.filter((item) => item !== channel)
        : [...form.channels, channel],
    );
  }

  async function submit() {
    setState("submitting");
    setMessage("");

    const payload: CampaignCreateInput = {
      businessName: form.businessName,
      productName: form.productName,
      productSummary: form.productSummary,
      source:
        mode === "website"
          ? { kind: "website", url: form.websiteUrl }
          : {
              kind: "product_idea",
              ideaName: form.ideaName,
              description: form.ideaDescription,
              stage: form.ideaStage,
            },
      audience: form.audience,
      geography: form.geography,
      goal: form.goal,
      leadCount: form.leadCount,
      monthlyBudgetUsd: form.monthlyBudgetUsd,
      channels: form.channels,
    };

    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { campaign?: { id: string }; error?: string };
      if (!response.ok || !data.campaign) throw new Error(data.error ?? "Campaign creation failed.");
      setCampaignId(data.campaign.id);
      setState("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Campaign creation failed.");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <section className="wizard-success">
        <span><Check size={24} /></span>
        <p className="section-label">Campaign accepted</p>
        <h2>Research has started.</h2>
        <p>
          Your campaign is truthfully marked <strong>Researching</strong>. No outreach has been sent,
          scheduled or approved.
        </p>
        <div>
          <a className="button-primary" href={`/dashboard?campaign=${campaignId}`}>
            View campaign <ArrowRight size={17} />
          </a>
          <a className="button-secondary" href="/campaigns/new">Create another</a>
        </div>
      </section>
    );
  }

  return (
    <section className="campaign-wizard">
      <div className="wizard-progress" aria-label={`Step ${step + 1} of ${stepNames.length}`}>
        {stepNames.map((name, index) => (
          <div className={index <= step ? "active" : ""} key={name}>
            <span>{index < step ? <Check size={13} /> : index + 1}</span>
            <small>{name}</small>
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="wizard-panel">
          <div className="panel-heading">
            <span>01 · PRODUCT CONTEXT</span>
            <h2>What are you taking to market?</h2>
            <p>Start with a live website or describe an idea that has not launched yet.</p>
          </div>
          <div className="source-choice">
            <button className={mode === "website" ? "active" : ""} onClick={() => setMode("website")} type="button">
              <Globe2 size={19} /><span><strong>Website</strong><small>We analyse your existing pages.</small></span>
            </button>
            <button className={mode === "idea" ? "active" : ""} onClick={() => setMode("idea")} type="button">
              <Lightbulb size={19} /><span><strong>Product idea</strong><small>No website or launch required.</small></span>
            </button>
          </div>
          <div className="field-grid two">
            <label>Business or founder name<input value={form.businessName} onChange={(event) => update("businessName", event.target.value)} placeholder="Acme Labs" /></label>
            <label>Product name<input value={form.productName} onChange={(event) => update("productName", event.target.value)} placeholder="SignalOS" /></label>
          </div>
          {mode === "website" ? (
            <label>Website URL<input value={form.websiteUrl} onChange={(event) => update("websiteUrl", event.target.value)} placeholder="https://example.com" type="url" /></label>
          ) : (
            <div className="field-grid idea-grid">
              <label>Idea name<input value={form.ideaName} onChange={(event) => update("ideaName", event.target.value)} placeholder="AI onboarding copilot" /></label>
              <label>Current stage<select value={form.ideaStage} onChange={(event) => update("ideaStage", event.target.value as FormState["ideaStage"])}><option value="concept">Concept</option><option value="prototype">Prototype</option><option value="mvp">MVP</option><option value="launched">Launched</option></select></label>
              <label className="full">Describe the idea<textarea value={form.ideaDescription} onChange={(event) => update("ideaDescription", event.target.value)} placeholder="What does it do, who needs it, and what painful problem does it solve?" rows={4} /></label>
            </div>
          )}
          <label>Product summary<textarea value={form.productSummary} onChange={(event) => update("productSummary", event.target.value)} placeholder="Explain the outcome customers get and why your approach is different." rows={4} /></label>
        </div>
      )}

      {step === 1 && (
        <div className="wizard-panel">
          <div className="panel-heading">
            <span>02 · MARKET</span>
            <h2>Who should care first?</h2>
            <p>Give the agents a strong starting hypothesis. Research will validate and sharpen it.</p>
          </div>
          <label>Ideal audience<textarea value={form.audience} onChange={(event) => update("audience", event.target.value)} placeholder="e.g. RevOps leaders at 50–500 person B2B SaaS companies struggling with stale CRM data" rows={5} /></label>
          <div className="field-grid two">
            <label>Primary geography<input value={form.geography} onChange={(event) => update("geography", event.target.value)} placeholder="United Kingdom and DACH" /></label>
            <label>Campaign goal<select value={form.goal} onChange={(event) => update("goal", event.target.value as FormState["goal"])}><option value="book_meetings">Book qualified meetings</option><option value="validate_demand">Validate market demand</option><option value="build_waitlist">Build a waitlist</option><option value="sell_product">Generate sales opportunities</option></select></label>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="wizard-panel">
          <div className="panel-heading">
            <span>03 · CAMPAIGN CONTROLS</span>
            <h2>Set a deliberate first run.</h2>
            <p>Choose the research depth and channels. Every message still requires approval.</p>
          </div>
          <div className="choice-section">
            <label>Verified lead target</label>
            <div className="option-row">
              {[10, 25, 50, 100].map((count) => (
                <button className={form.leadCount === count ? "active" : ""} onClick={() => update("leadCount", count as FormState["leadCount"])} type="button" key={count}>{count}</button>
              ))}
            </div>
          </div>
          <div className="field-grid two">
            <label>Monthly campaign budget (USD)<input min={100} onChange={(event) => update("monthlyBudgetUsd", Number(event.target.value))} type="number" value={form.monthlyBudgetUsd} /></label>
            <div className="choice-section">
              <label>Channels to prepare</label>
              <div className="channel-row">
                {(["email", "sms"] as const).map((channel) => (
                  <button className={form.channels.includes(channel) ? "active" : ""} onClick={() => toggleChannel(channel)} type="button" key={channel}><span>{form.channels.includes(channel) && <Check size={12} />}</span>{channel.toUpperCase()}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="approval-note"><Check size={18} /><div><strong>Human approval is mandatory.</strong><p>Generated copy remains “Copy Generated” or “Awaiting Approval.” It cannot become “Sent” without a confirmed provider event.</p></div></div>
        </div>
      )}

      {state === "error" && <div className="form-error" role="alert">{message}<button onClick={() => setState("idle")} type="button">Try again</button></div>}

      <div className="wizard-actions">
        {step > 0 ? <button className="button-secondary" onClick={() => setStep((current) => current - 1)} type="button"><ArrowLeft size={16} /> Back</button> : <a className="button-secondary" href="/">Cancel</a>}
        {step < 2 ? (
          <button className="button-primary" disabled={!canContinue} onClick={() => setStep((current) => current + 1)} type="button">Continue <ArrowRight size={16} /></button>
        ) : (
          <button className="button-primary" disabled={!canContinue || state === "submitting"} onClick={() => void submit()} type="button">
            {state === "submitting" ? <><LoaderCircle className="spin" size={17} /> Creating campaign</> : <>Start research <ArrowRight size={16} /></>}
          </button>
        )}
      </div>
    </section>
  );
}
