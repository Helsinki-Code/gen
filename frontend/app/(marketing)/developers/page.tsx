import type { Metadata } from "next";
import { MarketingPage } from "@/components/MarketingPage";
import { corePages } from "@/lib/marketing-content";

const page = corePages.developers;

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
  alternates: { canonical: "/developers" },
};

export default function DevelopersPage() {
  return <MarketingPage page={page} />;
}
