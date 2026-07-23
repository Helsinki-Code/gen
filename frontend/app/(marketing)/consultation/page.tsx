import { ConsultationPageContent } from "@/components/MarketingSitePages";
import { buildMarketingMetadata } from "@/lib/marketing-seo";

export const metadata = buildMarketingMetadata({
  title: "Book a Consultation - AmroGen",
  description: "Schedule a practical AmroGen consultation through AmroMeet to review your outbound workflow and MVP fit.",
  path: "/consultation",
});

export default function ConsultationPage() {
  return <ConsultationPageContent />;
}
