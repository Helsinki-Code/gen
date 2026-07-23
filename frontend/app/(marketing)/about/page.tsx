import { AboutPageContent } from "@/components/AboutPageContent";
import { buildMarketingMetadata } from "@/lib/marketing-seo";

export const metadata = buildMarketingMetadata({
  title: "About AmroGen - Built for Teams Who Need Pipeline Without a Big SDR Team",
  description:
    "AmroGen helps B2B teams turn company URLs into verified leads, reviewed outreach, and pipeline-ready campaigns without stitching together a stack.",
  path: "/about",
  imagePath: "/media/images/Hemant-Image.jpeg",
});

export default function AboutPage() {
  return <AboutPageContent />;
}
