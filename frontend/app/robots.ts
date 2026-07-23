import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/marketing-content";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/campaigns", "/settings", "/podcast-studio"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
