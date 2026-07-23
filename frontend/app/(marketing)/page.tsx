import { JsonLd, MarketingPage } from "@/components/MarketingPage";
import { corePages, homepageFaq, homepageInputModes, siteUrl } from "@/lib/marketing-content";
import { SUBSCRIPTION_PLANS } from "@/lib/pricing-plans";
import { buildMarketingMetadata } from "@/lib/marketing-seo";

const page = corePages.homepage;

export const metadata = buildMarketingMetadata({
  title: page.title,
  description: page.description,
  path: "/",
  imagePath: "/assets/images/logo/amrogen_light_logo.svg",
});

export default function LandingPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "AmroGen",
          url: siteUrl,
          description: page.description,
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "AmroGen",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          offers: {
            "@type": "Offer",
            price: String(SUBSCRIPTION_PLANS[0].pricePerCampaign),
            priceCurrency: "GBP",
          },
          description: page.description,
          featureList: homepageInputModes.map((mode) => `${mode.title} (${mode.statusLabel})`),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: homepageFaq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.answer,
            },
          })),
        }}
      />
      <MarketingPage page={page} />
    </>
  );
}
