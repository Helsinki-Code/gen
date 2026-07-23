import type { Metadata } from "next";
import { siteUrl } from "@/lib/marketing-content";

type PageSeoInput = {
  title: string;
  description: string;
  path: string;
  imagePath?: string;
};

export function buildMarketingMetadata({
  title,
  description,
  path,
  imagePath = "/assets/images/logo/amrogen_light_logo.svg",
}: PageSeoInput): Metadata {
  const url = `${siteUrl}${path}`;
  const imageUrl = `${siteUrl}${imagePath}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      siteName: "AmroGen",
      images: [{ url: imageUrl, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}
