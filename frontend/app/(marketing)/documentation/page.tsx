import { DocumentationPageContent } from "@/components/MarketingSitePages";
import { buildMarketingMetadata } from "@/lib/marketing-seo";

export const metadata = buildMarketingMetadata({
  title: "AmroGen Documentation",
  description: "Honest MVP documentation for AmroGen: campaigns, credits, Resend sending, API access, and roadmap items.",
  path: "/documentation",
});

export default function DocumentationPage() {
  return <DocumentationPageContent />;
}
