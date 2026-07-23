import { HowItWorksBottomSection } from "@/components/HowItWorksBottomSection";
import { JsonLd, MarketingPage } from "@/components/MarketingPage";
import { corePages, homepageInputModes, howItWorksFaq } from "@/lib/marketing-content";
import { buildMarketingMetadata } from "@/lib/marketing-seo";

const page = corePages.howItWorks;

export const metadata = buildMarketingMetadata({
  title: page.title,
  description: page.description,
  path: "/how-it-works",
  imagePath: "/assets/images/logo/amrogen_light_logo.svg",
});

export default function HowItWorksPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: page.title,
          description: page.description,
          url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://amrogen.com"}/how-it-works`,
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: howItWorksFaq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.answer,
            },
          })),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: "How AmroGen works",
          description: page.description,
          step: homepageInputModes.map((mode, index) => ({
            "@type": "HowToStep",
            position: index + 1,
            name: mode.title,
            text: mode.body,
          })),
        }}
      />
      <MarketingPage page={page} bottomSection={<HowItWorksBottomSection />} />
    </>
  );
}
