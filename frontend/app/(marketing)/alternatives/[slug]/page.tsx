import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingPage } from "@/components/MarketingPage";
import { alternativePages } from "@/lib/marketing-content";

export function generateStaticParams() {
  return Object.keys(alternativePages).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = alternativePages[slug];
  if (!page) return {};
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: page.slug },
  };
}

export default async function AlternativePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = alternativePages[slug];
  if (!page) notFound();
  return <MarketingPage page={page} />;
}
