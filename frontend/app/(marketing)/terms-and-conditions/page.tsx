import { TermsPageContent } from "@/components/MarketingSitePages";
import { buildMarketingMetadata } from "@/lib/marketing-seo";

export const metadata = buildMarketingMetadata({
  title: "Terms and Conditions - AmroGen",
  description: "Terms and conditions for using AmroGen.",
  path: "/terms-and-conditions",
});

export default function TermsPage() {
  return <TermsPageContent />;
}
