export const BRAND = {
  productName: "AmroGen",
  legalEntity: "Agentic AI Ltd",
  contactEmail: "info@agentic-ai.ltd",
  helloEmail: "hello@agentic-ai.ltd",
  phone: "+44 7771 970567",
  phoneTel: "+447771970567",
  location: "Tunbridge Wells, Kent, UK",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://amrogen.com",
} as const;

export type SuiteLink = {
  label: string;
  href: string;
  external?: boolean;
};

export const SUITE_PRODUCTS: SuiteLink[] = [
  { label: "AmroImage", href: "https://amroimage.ai", external: true },
  { label: "AmroMeet", href: "https://amromeet.com", external: true },
  { label: "Amro Agents", href: "https://amroagents.com", external: true },
  { label: "AmroPilot", href: "https://amropilot.ai", external: true },
  { label: "AmroGen", href: "https://amrogen.com", external: true },
  { label: "AmroAI Academy", href: "https://amroai.academy", external: true },
];

export const AMROMEET_BOOKING_URL =
  "https://amromeet.agentic-ai.ltd/#/book/agentic-ai-amro-consultation";
