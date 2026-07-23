export type DocSection = {
  id: string;
  title: string;
  description: string;
  topics: string[];
  href: string;
};

export type WalkthroughGuide = {
  id: string;
  title: string;
  description: string;
  duration: string;
  steps: string[];
  href: string;
};

export const AMROGEN_DOC_SECTIONS: DocSection[] = [
  {
    id: "getting-started",
    title: "Getting started",
    description: "Create an account, buy credits with Stripe, and launch your first reviewed campaign.",
    topics: ["Sign up with email and password", "JWT session auth", "Stripe credit packs", "Dashboard overview"],
    href: "/sign-up",
  },
  {
    id: "campaign-workflow",
    title: "Campaign workflow",
    description: "Three input modes from company URL, manual entry, or CSV import to approved Resend-ready email outreach.",
    topics: [
      "Company URL research (up to 25 leads)",
      "Manual lead entry without URL discovery",
      "CSV upload or public document URL import",
      "Reviewed email sequences and human approval before send",
    ],
    href: "/how-it-works",
  },
  {
    id: "credits-pricing",
    title: "Credits and pricing",
    description: "How credits map to pipeline runs and what each plan includes today.",
    topics: ["Starter, Growth, Scale plans", "Pay-as-you-go credits", "Approx. cost per run", "No per-seat fees"],
    href: "/documentation/pricing",
  },
  {
    id: "resend",
    title: "Resend email sending",
    description: "Connect Resend or use platform sending for approved email steps.",
    topics: ["Resend API key in settings", "Approved-only sending", "No Gmail integration in MVP", "Deliverability basics"],
    href: "/settings/resend",
  },
  {
    id: "developers",
    title: "API and MCP",
    description: "Programmatic access for builders embedding AmroGen in custom workflows.",
    topics: ["Bearer token auth", "Campaign endpoints", "Pipeline progress events", "MCP server setup"],
    href: "/developers",
  },
  {
    id: "roadmap",
    title: "Roadmap (not shipped yet)",
    description: "Features we describe honestly as future work — not available in the MVP today.",
    topics: [
      "LinkedIn execution",
      "SMS via Twilio",
      "Expanded multi-agent orchestration",
      "Agency white-label",
    ],
    href: "/how-it-works#roadmap",
  },
];

export const AMROGEN_WALKTHROUGHS: WalkthroughGuide[] = [
  {
    id: "first-campaign",
    title: "Launch your first campaign",
    description: "Walk through URL input, live pipeline progress, sequence review, and approval.",
    duration: "8 min read",
    steps: [
      "Sign in and confirm your credit balance on the dashboard.",
      "Open Campaigns → New and choose Company URL, Manual leads, or CSV / document.",
      "For URL mode, paste a target company website and choose a lead count.",
      "For manual or CSV mode, provide contacts and let AmroGen write sequences without URL research.",
      "Review each lead, approve sequences, and launch through Resend.",
    ],
    href: "/campaigns/new",
  },
  {
    id: "product-tour",
    title: "Product tour video",
    description: "Watch the homepage walkthrough of research, review, and outreach preparation.",
    duration: "1 min video",
    steps: [
      "Open the homepage product tour section.",
      "Follow URL → leads → reviewed sequences → approval.",
      "Use /how-it-works for step-by-step screenshots and documentation links.",
    ],
    href: "/how-it-works",
  },
  {
    id: "api-key",
    title: "Create an API key",
    description: "Generate a bearer token for REST or MCP integrations.",
    duration: "3 min read",
    steps: [
      "Sign in and open Settings → API keys.",
      "Create a key and store it securely.",
      "Use the Developers page for endpoint references and MCP configuration examples.",
    ],
    href: "/settings/api-keys",
  },
];

export const AMROGEN_TROUBLESHOOTING = [
  {
    question: "Why do I only see email outreach in the MVP?",
    answer:
      "AmroGen ships email-first today through Resend. LinkedIn and SMS are on the roadmap and are not presented as live product capabilities.",
  },
  {
    question: "How many leads can one run generate?",
    answer:
      "The MVP caps lead volume to keep runs predictable — currently up to 25 verified leads per pipeline run.",
  },
  {
    question: "Can AmroGen send without my approval?",
    answer:
      "No. Approved email steps only send after you review and approve the campaign output.",
  },
  {
    question: "Do you integrate with Gmail?",
    answer:
      "Not in the current MVP. Email sending is handled through Resend, not a connected Gmail inbox.",
  },
];
