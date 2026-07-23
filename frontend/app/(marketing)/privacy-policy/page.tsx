import { PrivacyPolicyPageContent } from "@/components/MarketingSitePages";
import { buildMarketingMetadata } from "@/lib/marketing-seo";

export const metadata = buildMarketingMetadata({
  title: "Privacy Policy - AmroGen",
  description: "Privacy policy for AmroGen and Agentic AI Ltd.",
  path: "/privacy-policy",
});

export default function PrivacyPolicyPage() {
  return <PrivacyPolicyPageContent />;
}
