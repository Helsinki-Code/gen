import { CareersPageContent } from "@/components/MarketingSitePages";
import { buildMarketingMetadata } from "@/lib/marketing-seo";

export const metadata = buildMarketingMetadata({
  title: "Careers - Agentic AI Ltd",
  description: "Careers at Agentic AI Ltd, builders of AmroGen and the Amro product suite.",
  path: "/careers",
});

export default function CareersPage() {
  return <CareersPageContent />;
}
