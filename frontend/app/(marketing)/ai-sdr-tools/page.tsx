import type { Metadata } from "next";
import { JsonLd, MarketingPage } from "@/components/MarketingPage";
import { Feature } from "@/components/ui/feature-section-with-bento-grid";
import { corePages, siteUrl } from "@/lib/marketing-content";

const page = corePages["ai-sdr-tools"];

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
  alternates: { canonical: "/ai-sdr-tools" },
};

export default function AiSdrToolsPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: page.h1,
          url: `${siteUrl}/ai-sdr-tools`,
          description: page.description,
        }}
      />
      <MarketingPage page={page} bottomSection={<Feature />} />
    </>
  );
}
