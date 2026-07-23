import type { LucideIcon } from "lucide-react";
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  Code2,
  Database,
  FileUp,
  GitBranch,
  Globe,
  Mail,
  MessageSquareText,
  MousePointer2,
  PencilLine,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Zap,
} from "lucide-react";
import {
  APPROX_PAYG_RUN_GBP,
  formatPlanPrice,
  PAYG_CREDIT_PRICE_GBP,
  SUBSCRIPTION_PLANS,
} from "@/lib/pricing-plans";

const starterPlan = SUBSCRIPTION_PLANS[0];
const professionalPlan = SUBSCRIPTION_PLANS[1];
const enterprisePlan = SUBSCRIPTION_PLANS[2];

export type MarketingPageContent = {
  slug: string;
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  subheadline: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  stats?: { value: string; label: string }[];
  sections: {
    eyebrow?: string;
    title: string;
    body?: string;
    items?: { title: string; body: string; icon?: LucideIcon }[];
    table?: { columns: string[]; rows: string[][] };
  }[];
};

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://amrogen.com";

export type InputModeStatus = "live" | "roadmap";

export type HomepageInputMode = {
  id: string;
  title: string;
  body: string;
  status: InputModeStatus;
  statusLabel: string;
  icon: LucideIcon;
  example: string;
};

export type HomepageFaqItem = {
  question: string;
  answer: string;
};

export const homepageInputModes: HomepageInputMode[] = [
  {
    id: "url",
    title: "Company URL",
    body:
      "Paste a target account, competitor customer, or sponsor website. The AI coordinator researches the company, finds verified decision-makers, and drafts personalised email sequences.",
    status: "live",
    statusLabel: "Available now",
    icon: Globe,
    example: "https://acme.com",
  },
  {
    id: "manual",
    title: "Manual lead entry",
    body:
      "Add contacts one at a time or paste structured rows when you already know who to reach. Skips account research and moves straight to sequence writing and review.",
    status: "live",
    statusLabel: "Available now",
    icon: PencilLine,
    example: "Name, title, email, company",
  },
  {
    id: "document",
    title: "Document or file location",
    body:
      "Upload a CSV lead list or provide a public CSV URL. AmroGen stores the source file, ingests the contacts, and writes personalised sequences without URL research.",
    status: "live",
    statusLabel: "Available now",
    icon: FileUp,
    example: "leads.csv or /docs/account-brief.md",
  },
];

export const homepageFaq: HomepageFaqItem[] = [
  {
    question: "What is AmroGen?",
    answer:
      "AmroGen is an AI sales agent for B2B teams. It turns a target company URL into verified decision-maker leads, writes personalised cold email sequences, scores output quality, and prepares Resend-ready outreach for human approval before anything sends.",
  },
  {
    question: "How do I start a campaign in AmroGen today?",
    answer:
      "Sign in, open Campaigns → New, paste a company URL, choose how many leads you want (up to 25 in the MVP), and start the pipeline. When status moves to review, inspect each lead and sequence, approve individually or in bulk, then launch through Resend.",
  },
  {
    question: "Can I upload a CSV or add leads manually?",
    answer:
      "Yes. Open Campaigns → New and choose Manual leads to enter contacts row by row, or CSV / document to upload a file or paste a public CSV URL. URL-based discovery remains the default when you start from a company website.",
  },
  {
    question: "Does AmroGen send email automatically?",
    answer:
      "No blind autopilot. Every email step requires your approval first. Approved sequences send through Resend using your connected API key or platform sending. Weak drafts are scored and retried before you see them.",
  },
  {
    question: "How is AmroGen different from Apollo, Clay, or Instantly?",
    answer:
      "Apollo is strongest as a contact database. Clay excels at custom enrichment tables. Instantly focuses on high-volume cold email infrastructure. AmroGen combines URL-first lead research, AI-written sequences, automated quality review, and Resend sending in one coordinator-led pipeline — without requiring a pre-built lead list.",
  },
  {
    question: "What does an AmroGen campaign cost?",
    answer:
      `Credits scale with lead volume. A typical run with about 10 leads costs roughly 8 credits (about ${formatPlanPrice(APPROX_PAYG_RUN_GBP)} on pay-as-you-go). Plans are priced per campaign — Starter ${formatPlanPrice(starterPlan.pricePerCampaign)}/campaign, Professional ${formatPlanPrice(professionalPlan.pricePerCampaign)}/campaign, Enterprise ${formatPlanPrice(enterprisePlan.pricePerCampaign)}/campaign.`,
  },
  {
    question: "Can developers integrate AmroGen into other tools?",
    answer:
      "Yes. AmroGen exposes REST API endpoints for campaign creation, lead inspection, sequence approval, and sending. An MCP server lets you call AmroGen from Claude Desktop and other AI-agent environments.",
  },
  {
    question: "What channels does AmroGen support?",
    answer:
      "The MVP is email-first via Resend. LinkedIn and SMS execution are described honestly as roadmap items — not available in production today.",
  },
];

export const howItWorksFaq: HomepageFaqItem[] = [
  {
    question: "What does an AmroGen run actually do?",
    answer:
      "A coordinator-led pipeline researches or ingests your contacts, writes personalised email sequences per lead, scores quality automatically, and prepares Resend-ready output for your approval. Typical runs complete in a few minutes.",
  },
  {
    question: "Do I have to start from a company URL?",
    answer:
      "No. URL-based discovery is one input mode. You can also enter leads manually or import a CSV or document URL — the coordinator skips account research and moves straight to sequence writing and review.",
  },
  {
    question: "How does the quality review loop work?",
    answer:
      "The Orchestrator scores every sequence from 1–10 on personalisation, format compliance, content quality, and channel rules. Batches scoring below 7 are sent back for revision with feedback — up to three attempts before you see the output.",
  },
  {
    question: "Does AmroGen send email automatically?",
    answer:
      "No. Human approval is required before any email step sends. Approved messages deliver through your connected or platform Resend account.",
  },
  {
    question: "Can developers integrate AmroGen into other tools?",
    answer:
      "Yes. REST API endpoints cover campaign creation, lead inspection, sequence approval, and sending. An MCP server lets you call AmroGen from Claude Desktop and other AI-agent environments.",
  },
];

export const corePages: Record<string, MarketingPageContent> = {
  homepage: {
    slug: "/",
    title: "AmroGen - AI Sales Agent for B2B Lead Generation & Personalised Outreach",
    description:
      "AmroGen is an AI sales agent that turns a company URL into verified B2B leads and reviewed cold email sequences. URL-based campaigns ship today; manual entry and document upload are on the roadmap. Human approval before Resend send.",
    eyebrow: "AI sales agents for B2B outreach",
    h1: "An AI sales agent that turns company context into verified leads and reviewed outreach.",
    subheadline:
      "Start with a company URL, enter leads manually, or import a CSV. AmroGen researches or ingests your contacts, writes personalised email sequences, scores quality, and prepares Resend-ready campaigns for your approval.",
    primaryCta: { label: "Start your first campaign", href: "/sign-up" },
    secondaryCta: { label: "Book a demo", href: "/consultation#book-demo" },
    stats: [
      { value: "3-8 min", label: "URL to sequences" },
      { value: "25", label: "MVP lead cap" },
      { value: formatPlanPrice(APPROX_PAYG_RUN_GBP), label: "Approx. PAYG run" },
      { value: "1", label: "Coordinator run" },
    ],
    sections: [
      {
        eyebrow: "The problem",
        title: "Your SDR spends most of the day not selling.",
        body:
          "Manual research, contact lookup, enrichment, sequence writing, and follow-up tracking all happen before a real sales conversation. AmroGen compresses the email-ready work into one reviewable pipeline.",
        items: [
          { title: "URL-based lead discovery", body: "Start from a target company's website instead of a stale contact list.", icon: Globe },
          { title: "Quality-reviewed copy", body: "The Orchestrator scores and retries weak outreach before you approve it.", icon: ShieldCheck },
          { title: "Resend email sending", body: "Approved email steps send through your connected or platform Resend account.", icon: Mail },
        ],
      },
      {
        eyebrow: "Workflow",
        title: "From URL to pipeline-ready outreach",
        body:
          "The product is designed for teams that do not want to stitch together a database, enrichment table, copy generator, QA checklist, and sending tool just to run one outbound campaign.",
        items: [
          { title: "Enter a URL", body: "Point AmroGen at a target account, competitor customer, or conference sponsor.", icon: MousePointer2 },
          { title: "Find decision-makers", body: "The Lead Generator returns verified contacts with ICP fit context.", icon: Users },
          { title: "Approve and send", body: "Review each sequence, approve individually or in bulk, and launch through Resend.", icon: CheckCircle2 },
        ],
      },
      {
        eyebrow: "Pipeline",
        title: "One coordinator-led run from URL to reviewed email outreach",
        body:
          "The MVP uses one coordinator run that researches the account, drafts email sequences, scores quality, and prepares Resend-ready output for your approval.",
        items: [
          { title: "Lead research", body: "Finds relevant people from company context instead of asking you to upload a lead list.", icon: Database },
          { title: "Email sequences", body: "Writes five-step cold email flows grounded in the target account and lead role.", icon: Mail },
          { title: "Quality review", body: "Scores output, retries weak drafts, and only surfaces copy that passed the bar.", icon: BrainCircuit },
          { title: "Cost guardrails", body: "Caps lead volume per run and keeps the MVP email-first until more channels ship.", icon: MessageSquareText },
        ],
      },
      {
        eyebrow: "Quality control",
        title: "Built for reviewed automation, not blind autopilot",
        body:
          "Most AI SDR products sell autonomy. AmroGen is built around the practical middle ground: automate the repetitive work, keep humans in control of approval, and make weak output visible before it reaches a prospect.",
        table: {
          columns: ["Workflow step", "Old outbound stack", "AmroGen"],
          rows: [
            ["Lead source", "Buy or filter a database", "Start from a company URL"],
            ["Research", "Manual tabs and enrichment tools", "Agent-led account and lead context"],
            ["Copy", "Generic sequence templates", "Lead-specific email sequences"],
            ["Quality", "Rep reviews everything from scratch", "Automated score, retry, then human approval"],
            ["Sending", "Separate sequencer setup", "Approved email sends through Resend"],
          ],
        },
      },
      {
        eyebrow: "Best fit",
        title: "Use AmroGen when you need pipeline motion without rebuilding RevOps",
        body:
          "It is strongest for founders, lean GTM teams, agencies, and operators who know their target accounts but do not want to spend hours turning each account into a researched campaign.",
        items: [
          { title: "Founder-led sales", body: "Turn target accounts into personalized first-touch campaigns without hiring an SDR first.", icon: Target },
          { title: "Agencies", body: "Create reviewable campaigns for multiple clients without rebuilding the workflow each time.", icon: GitBranch },
          { title: "Small B2B teams", body: "Run focused outbound experiments without paying for a large database and sequencer stack.", icon: Zap },
          { title: "AI-native builders", body: "Use the API and MCP server to embed outbound actions into custom workflows.", icon: Code2 },
        ],
      },
    ],
  },
  howItWorks: {
    slug: "/how-it-works",
    title: "How AmroGen Works - AI Sales Agent for B2B Outreach",
    description:
      "See how AmroGen turns company context into verified leads, quality-reviewed email sequences, and Resend-ready outreach — with human approval at every send.",
    eyebrow: "How it works",
    h1: "One pipeline from context to reviewed outreach.",
    subheadline:
      "AmroGen replaces the patchwork of databases, enrichment tables, copy tools, and senders with a single AI coordinator. You bring the accounts; it prepares personalised, quality-checked email ready for your approval.",
    primaryCta: { label: "Start your first campaign", href: "/sign-up" },
    secondaryCta: { label: "Book a demo", href: "/consultation#book-demo" },
    stats: [
      { value: "3–8 min", label: "Typical run time" },
      { value: "6", label: "Specialist agents" },
      { value: "Human", label: "Approval required" },
      { value: "Resend", label: "Email delivery" },
    ],
    sections: [
      {
        eyebrow: "The problem",
        title: "Your SDR spends most of the day not selling.",
        body:
          "Manual research, contact lookup, enrichment, sequence writing, and follow-up tracking all happen before a real sales conversation. AmroGen compresses the email-ready work into one reviewable pipeline.",
        items: [
          {
            title: "Context-first campaigns",
            body: "Start from a target account, known contacts, or an imported list — not a stale database rental.",
            icon: Globe,
          },
          {
            title: "Quality-reviewed copy",
            body: "The Orchestrator scores and retries weak outreach before you approve it.",
            icon: ShieldCheck,
          },
          {
            title: "Resend email sending",
            body: "Approved email steps send through your connected or platform Resend account.",
            icon: Mail,
          },
        ],
      },
      {
        eyebrow: "Under the hood",
        title: "Coordinator-led research and copy",
        body:
          "A single run orchestrates specialist agents: lead research, sequence writing, and an editorial review pass before anything reaches your inbox.",
        items: [
          {
            title: "Lead research",
            body: "Finds relevant people from company context or ingests contacts you provide.",
            icon: Database,
          },
          {
            title: "Email sequences",
            body: "Writes multi-step cold email flows grounded in the target account and lead role.",
            icon: Mail,
          },
          {
            title: "Quality review",
            body: "Scores output on personalisation, format, tone, and channel rules — retries batches below 7/10.",
            icon: BrainCircuit,
          },
          {
            title: "Your approval",
            body: "Nothing sends until you approve individually or in bulk.",
            icon: ShieldCheck,
          },
        ],
      },
      {
        eyebrow: "Quality loop",
        title: "AI reviews its own output before you do",
        body:
          "The Orchestrator scores every sequence from 1–10 on four criteria. Weak batches are sent back with feedback — up to three revision attempts before you see the output.",
        items: [
          {
            title: "Personalisation depth",
            body: "Copy must reflect the lead's role, company, and fit — not generic templates.",
            icon: Target,
          },
          {
            title: "Format compliance",
            body: "Subject lines, message length, and channel rules are checked automatically.",
            icon: CheckCircle2,
          },
          {
            title: "Human-sounding tone",
            body: "Template openers and generic value props fail the review pass.",
            icon: MessageSquareText,
          },
          {
            title: "Retry with feedback",
            body: "Scores below 7 trigger another draft with the rejection reason in context.",
            icon: Sparkles,
          },
        ],
      },
      {
        eyebrow: "Quality control",
        title: "Built for reviewed automation, not blind autopilot",
        body:
          "Most AI SDR products sell autonomy. AmroGen automates repetitive work while keeping humans in control of approval — and makes weak output visible before it reaches a prospect.",
        table: {
          columns: ["Workflow step", "Old outbound stack", "AmroGen"],
          rows: [
            ["Lead source", "Buy or filter a database", "Context you provide — URL, contacts, or import"],
            ["Research", "Manual tabs and enrichment tools", "Agent-led account and lead context"],
            ["Copy", "Generic sequence templates", "Lead-specific email sequences"],
            ["Quality", "Rep reviews everything from scratch", "Automated score, retry, then human approval"],
            ["Sending", "Separate sequencer setup", "Approved email sends through Resend"],
          ],
        },
      },
      {
        eyebrow: "For builders",
        title: "API and MCP when you need programmatic control",
        body:
          "Embed the same pipeline in custom workflows — create campaigns, inspect leads, approve sequences, and monitor events without opening the dashboard.",
        items: [
          {
            title: "REST API",
            body: "Auth, credits, campaign lifecycle, and lead inspection for your stack.",
            icon: Code2,
          },
          {
            title: "MCP server",
            body: "Call AmroGen from Claude Desktop and other agent environments.",
            icon: Bot,
          },
          {
            title: "Pipeline events",
            body: "Monitor coordinator status as research and sequences complete.",
            icon: GitBranch,
          },
        ],
      },
      {
        eyebrow: "Best fit",
        title: "Use AmroGen when you need pipeline motion without rebuilding RevOps",
        body:
          "It is strongest for founders, lean GTM teams, agencies, and operators who know their target accounts but do not want to spend hours turning each account into a researched campaign.",
        items: [
          {
            title: "Founder-led sales",
            body: "Turn target accounts into personalized first-touch campaigns without hiring an SDR first.",
            icon: Target,
          },
          {
            title: "Agencies",
            body: "Create reviewable campaigns for multiple clients without rebuilding the workflow each time.",
            icon: GitBranch,
          },
          {
            title: "Small B2B teams",
            body: "Run focused outbound experiments without paying for a large database and sequencer stack.",
            icon: Zap,
          },
          {
            title: "AI-native builders",
            body: "Use the API and MCP server to embed outbound actions into custom workflows.",
            icon: Code2,
          },
        ],
      },
    ],
  },
  pricing: {
    slug: "/pricing",
    title: `AmroGen Pricing - AI Outreach from ${formatPlanPrice(starterPlan.pricePerCampaign)}/campaign`,
    description:
      `Campaign-based pricing for AI lead generation and personalised outreach. Starter ${formatPlanPrice(starterPlan.pricePerCampaign)}/campaign, Professional ${formatPlanPrice(professionalPlan.pricePerCampaign)}/campaign, Enterprise ${formatPlanPrice(enterprisePlan.pricePerCampaign)}/campaign. Save 10–20% on 10-campaign packs.`,
    eyebrow: "Per campaign",
    h1: "Price per campaign. Save on 10-packs.",
    subheadline:
      "Starter, Professional, and Enterprise are priced per campaign. Buy 10 campaigns and get 10–20% off.",
    primaryCta: { label: "Start Starter", href: "/sign-up" },
    secondaryCta: { label: "Launch a campaign", href: "/campaigns/new" },
    stats: [
      { value: formatPlanPrice(starterPlan.pricePerCampaign), label: "Starter /camp." },
      { value: formatPlanPrice(professionalPlan.pricePerCampaign), label: "Professional /camp." },
      { value: formatPlanPrice(enterprisePlan.pricePerCampaign), label: "Enterprise /camp." },
      { value: formatPlanPrice(PAYG_CREDIT_PRICE_GBP), label: "Per credit PAYG" },
    ],
    sections: [
      {
        title: "Plans built around campaigns",
        table: {
          columns: ["Plan", "Per campaign", "10-pack", "Discount", "Best for"],
          rows: [
            ["Starter", formatPlanPrice(starterPlan.pricePerCampaign), formatPlanPrice(starterPlan.packPrice), "10%", "Founders and small tests"],
            ["Professional", formatPlanPrice(professionalPlan.pricePerCampaign), formatPlanPrice(professionalPlan.packPrice), "15%", "GTM teams"],
            ["Enterprise", formatPlanPrice(enterprisePlan.pricePerCampaign), formatPlanPrice(enterprisePlan.packPrice), "20%", "Agencies and outbound teams"],
          ],
        },
      },
      {
        title: "Every plan includes the full email workflow",
        items: [
          { title: "Lead discovery", body: "Find decision-makers from a company URL.", icon: Target },
          { title: "Reviewed email sequences", body: "Generate, score, and approve email copy before send.", icon: MessageSquareText },
          { title: "API and MCP access", body: "Use AmroGen from your own tools and AI workflows.", icon: Code2 },
        ],
      },
    ],
  },
  about: {
    slug: "/about",
    title: "About AmroGen - Built for Teams Who Need Pipeline Without a Big SDR Team",
    description:
      "AmroGen helps B2B teams turn company URLs into verified leads, reviewed outreach, and pipeline-ready campaigns without stitching together a stack.",
    eyebrow: "Why AmroGen exists",
    h1: "Built for teams that need pipeline without adding a big SDR team.",
    subheadline:
      "The product is designed around one belief: AI should remove repetitive outbound work while keeping human judgment in the approval loop.",
    primaryCta: { label: "Start your first campaign", href: "/sign-up" },
    secondaryCta: { label: "See the AI SDR hub", href: "/ai-sdr-tools" },
    sections: [
      {
        title: "One pipeline instead of five disconnected tools",
        body:
          "Apollo gives you a database. Clay gives you enrichment. Instantly gives you sending. ChatGPT gives you drafts. AmroGen combines lead research, email copy, quality review, and Resend sending in one workflow.",
        items: [
          { title: "Pragmatic automation", body: "The goal is fewer handoffs and better campaigns, not blind autopilot.", icon: GitBranch },
          { title: "Quality before volume", body: "Reviewed, specific outreach beats generic activity every time.", icon: ShieldCheck },
          { title: "Builder-friendly", body: "REST API and MCP access make the workflow usable from AI-native systems.", icon: Code2 },
        ],
      },
    ],
  },
  "ai-sdr-tools": {
    slug: "/ai-sdr-tools",
    title: "Best AI SDR Tools in 2026 - Compared Honestly",
    description:
      "A practical AI SDR tools hub comparing AmroGen, autonomous agents, copilots, databases, and senders by quality, deliverability, and cost.",
    eyebrow: "AI SDR tools hub",
    h1: "Best AI SDR tools in 2026, compared by what actually books meetings.",
    subheadline:
      "The strongest AI SDR tools do more than automate activity. They research, write, review, protect deliverability, and make the handoff to humans clear.",
    primaryCta: { label: "Start with AmroGen", href: "/sign-up" },
    secondaryCta: { label: "Read the full comparison", href: "/blog/best-ai-sdr-tools-2026" },
    sections: [
      {
        title: "What an AI SDR tool actually needs to do",
        items: [
          { title: "Find the right people", body: "Lead discovery should return decision-makers, not just contacts.", icon: Users },
          { title: "Write from context", body: "The message should be based on company and lead research.", icon: Sparkles },
          { title: "Check before send", body: "A quality gate catches generic or inaccurate output before prospects see it.", icon: ShieldCheck },
        ],
      },
      {
        title: "Core category map",
        table: {
          columns: ["Category", "What it does", "Best fit"],
          rows: [
            ["Research-first pipeline", "Leads, copy, review, sending", "Teams without a lead list"],
            ["Autonomous agent", "High-volume prospecting automation", "Simple lower-risk motions"],
            ["Copilot", "Drafting and workflow assistance", "Teams that want human review"],
            ["Database", "Contact inventory and enrichment", "High-volume list building"],
          ],
        },
      },
    ],
  },
  developers: {
    slug: "/developers",
    title: "AmroGen API & MCP Server - Embed B2B Outreach in Any AI Workflow",
    description:
      "Use AmroGen through REST APIs and MCP tools for B2B lead generation, outreach automation, and AI-agent workflows.",
    eyebrow: "Developer platform",
    h1: "Embed B2B outreach in your own AI workflows.",
    subheadline:
      "Use the REST API for platform access and the MCP server to call AmroGen from Claude Desktop and other AI-agent environments.",
    primaryCta: { label: "Create an API key", href: "/settings/api-keys" },
    secondaryCta: { label: "See pricing", href: "/pricing" },
    sections: [
      {
        title: "Two integration paths",
        items: [
          { title: "REST API", body: "Create campaigns, inspect leads, monitor sequence state, and approve sends — not blind autopilot.", icon: Code2 },
          { title: "MCP server", body: "Expose AmroGen as a callable tool inside AI-native workflows.", icon: Bot },
          { title: "Pipeline events", body: "Stream campaign progress from lead generation through review and approval.", icon: Zap },
        ],
      },
      {
        title: "Developer keywords AmroGen can own",
        table: {
          columns: ["Keyword", "Intent", "Page"],
          rows: [
            ["outreach API B2B", "Transactional", "/developers"],
            ["MCP server sales tool", "Informational / transactional", "/developers"],
            ["programmatic B2B outreach", "Developer research", "/developers"],
          ],
        },
      },
    ],
  },
};

export const featurePages: Record<string, MarketingPageContent> = {
  "lead-generation": {
    slug: "/features/lead-generation",
    title: "AI Lead Generation for B2B - Find Verified Decision-Makers From Any URL",
    description:
      "AmroGen finds verified B2B decision-makers from a company URL with email, LinkedIn, phone, location, and ICP fit score.",
    eyebrow: "Feature",
    h1: "AI lead generation for B2B, starting from a company URL.",
    subheadline:
      "The coordinator researches live company sources and returns verified decision-makers for review before email outreach begins.",
    primaryCta: { label: "Generate leads from a URL", href: "/campaigns/new" },
    secondaryCta: { label: "Read the lead generation guide", href: "/blog/ai-b2b-lead-generation" },
    sections: [
      {
        title: "What the lead generator returns",
        items: [
          { title: "Verified email", body: "Contact information checked at campaign time.", icon: Mail },
          { title: "LinkedIn and role context", body: "Current title, company, location, and profile context.", icon: Users },
          { title: "ICP fit score", body: "High, medium, or low fit based on the campaign target.", icon: Target },
        ],
      },
    ],
  },
  "ai-sequences": {
    slug: "/features/ai-sequences",
    title: "AI-Written Cold Email Sequences - Personalised Per Lead, Reviewed Before You See Them",
    description:
      "AmroGen writes personalised outreach sequences and reviews them for personalisation depth, accuracy, format, and quality before approval.",
    eyebrow: "Feature",
    h1: "AI-written sequences that get reviewed before you see them.",
    subheadline:
      "The coordinator writes personalised email sequences, scores the output, and retries weak drafts automatically before you approve them.",
    primaryCta: { label: "Create a reviewed sequence", href: "/campaigns/new" },
    secondaryCta: { label: "Read about personalised email AI", href: "/blog/personalized-cold-email-ai" },
    sections: [
      {
        title: "The quality review loop",
        items: [
          { title: "Personalisation depth", body: "Checks whether the copy references lead-specific context.", icon: BrainCircuit },
          { title: "Format compliance", body: "Keeps email steps, subjects, and structure inside the approved MVP format.", icon: CheckCircle2 },
          { title: "Automatic retries", body: "Drafts below the threshold are sent back before approval.", icon: ShieldCheck },
        ],
      },
    ],
  },
  "email-outreach": {
    slug: "/features/email-outreach",
    title: "B2B Email Outreach - Verified Leads and Reviewed Sequences from One Pipeline Run",
    description:
      "Generate coordinated email outreach from one AmroGen pipeline run, with verified leads, review, and Resend sending built in.",
    eyebrow: "Feature",
    h1: "Verified B2B email outreach from one pipeline run.",
    subheadline:
      "AmroGen focuses the MVP on email-ready leads and approved Resend sequences before adding more channels.",
    primaryCta: { label: "Build an email campaign", href: "/campaigns/new" },
    secondaryCta: { label: "Compare AI SDR tools", href: "/ai-sdr-tools" },
    sections: [
      {
        title: "One campaign, one sendable channel",
        items: [
          { title: "Email sequences", body: "Cold email flows sent through Resend after approval.", icon: Mail },
          { title: "Verified leads", body: "Contacts without usable email are filtered out before review.", icon: MessageSquareText },
          { title: "Cost guardrails", body: "A lower lead cap keeps early campaign runs predictable.", icon: Zap },
        ],
      },
    ],
  },
};

export const alternativePages: Record<string, MarketingPageContent> = {
  "apollo-alternative": {
    slug: "/alternatives/apollo-alternative",
    title: "AmroGen vs Apollo.io - AI Outreach vs Lead Database (2026)",
    description:
      "Compare AmroGen and Apollo.io for live URL-based lead research, personalised outreach, quality review, and Resend sending.",
    eyebrow: "Alternative",
    h1: "AmroGen vs Apollo: live outreach pipeline versus contact database.",
    subheadline:
      "Apollo is strong when you need a large database. AmroGen is stronger when you want fresh account-specific research and reviewed outreach from a URL.",
    primaryCta: { label: "Try AmroGen", href: "/sign-up" },
    secondaryCta: { label: "See pricing", href: "/pricing" },
    sections: [
      {
        title: "Where each wins",
        table: {
          columns: ["Need", "Apollo", "AmroGen"],
          rows: [
            ["Large contact inventory", "Strong", "Targeted per URL"],
            ["Live account research", "Limited", "Strong"],
            ["AI-written reviewed outreach", "Limited", "Strong"],
            ["No lead list required", "No", "Yes"],
          ],
        },
      },
    ],
  },
  "clay-alternative": {
    slug: "/alternatives/clay-alternative",
    title: "AmroGen vs Clay - AI Outreach vs Data Enrichment (2026)",
    description:
      "Compare Clay and AmroGen for enrichment workflows, setup complexity, outreach writing, quality review, and sending.",
    eyebrow: "Alternative",
    h1: "AmroGen vs Clay: full pipeline versus enrichment workspace.",
    subheadline:
      "Clay is powerful for RevOps teams building custom enrichment systems. AmroGen is built for teams that want leads, copy, review, and sending in one run.",
    primaryCta: { label: "Try AmroGen", href: "/sign-up" },
    secondaryCta: { label: "Read the AI SDR hub", href: "/ai-sdr-tools" },
    sections: [
      {
        title: "The core trade-off",
        items: [
          { title: "Clay wins on custom enrichment", body: "Best when a RevOps operator owns the workflow.", icon: Database },
          { title: "AmroGen wins on speed", body: "Start from a URL and produce reviewable outreach without building tables.", icon: Zap },
          { title: "AmroGen includes sending", body: "Approved email steps dispatch through Resend.", icon: Mail },
        ],
      },
    ],
  },
  "instantly-alternative": {
    slug: "/alternatives/instantly-alternative",
    title: "AmroGen vs Instantly.ai - AI Outreach vs Cold Email Sender (2026)",
    description:
      "Compare AmroGen and Instantly for cold email infrastructure, Resend sending, lead research, and personalised outreach.",
    eyebrow: "Alternative",
    h1: "AmroGen vs Instantly: writing-first pipeline versus sending infrastructure.",
    subheadline:
      "Instantly is excellent for high-volume cold email infrastructure. AmroGen is for targeted campaigns where lead research and copy quality are the bottleneck.",
    primaryCta: { label: "Try AmroGen", href: "/sign-up" },
    secondaryCta: { label: "Read cold email tool guide", href: "/blog/cold-email-tool-b2b" },
    sections: [
      {
        title: "Which should you choose?",
        items: [
          { title: "Choose Instantly for volume", body: "Mailbox rotation, warmup, and cold-domain infrastructure.", icon: Mail },
          { title: "Choose AmroGen for quality", body: "Lead research, personalised copy, review loop, and Resend sending.", icon: ShieldCheck },
        ],
      },
    ],
  },
  "lemlist-alternative": {
    slug: "/alternatives/lemlist-alternative",
    title: "AmroGen vs Lemlist - AI-Written Outreach vs Template Personalisation (2026)",
    description:
      "Compare Lemlist and AmroGen for creative cold outreach, template personalisation, AI-written sequences, and quality review.",
    eyebrow: "Alternative",
    h1: "AmroGen vs Lemlist: research-first copy versus template personalisation.",
    subheadline:
      "Lemlist is useful for creative sequence building. AmroGen is built for teams that want the research and writing done per lead.",
    primaryCta: { label: "Try AmroGen", href: "/sign-up" },
    secondaryCta: { label: "Read personalization guide", href: "/blog/personalized-cold-email-ai" },
    sections: [
      {
        title: "The core question",
        body:
          "Do you already have a lead list and a sequence strategy, or do you need the system to research the account, write the copy, review it, and prepare it for sending?",
        items: [
          { title: "Lemlist wins for creative campaigns", body: "Good when a human owns strategy and copy.", icon: Sparkles },
          { title: "AmroGen wins for research-first campaigns", body: "Good when the work starts with a target company URL.", icon: Globe },
        ],
      },
    ],
  },
};

export function getMarketingPage(slug: string) {
  return corePages[slug] || featurePages[slug] || alternativePages[slug];
}

export const publicMarketingPaths = [
  ...Object.values(corePages).map((page) => page.slug),
  ...Object.values(featurePages).map((page) => page.slug),
  ...Object.values(alternativePages).map((page) => page.slug),
  "/documentation",
  "/documentation/pricing",
  "/contact",
  "/consultation",
  "/privacy-policy",
  "/terms-and-conditions",
  "/careers",
  "/podcasts",
];
