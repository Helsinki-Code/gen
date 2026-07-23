import { ContactPageContent } from "@/components/MarketingSitePages";
import { buildMarketingMetadata } from "@/lib/marketing-seo";

export const metadata = buildMarketingMetadata({
  title: "Contact AmroGen",
  description: "Contact Agentic AI Ltd about AmroGen, B2B outreach, credits, Resend setup, and enterprise use.",
  path: "/contact",
});

export default function ContactPage() {
  return <ContactPageContent />;
}
