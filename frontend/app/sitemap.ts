import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";
import { publicMarketingPaths, siteUrl } from "@/lib/marketing-content";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages = publicMarketingPaths.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: now,
    changeFrequency: path === "/" ? ("weekly" as const) : ("monthly" as const),
    priority: path === "/" ? 1 : path.includes("/alternatives") ? 0.85 : 0.8,
  }));

  const posts = getAllPosts().map((post) => ({
    url: `${siteUrl}/blog/${post.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.75,
  }));

  return [...pages, { url: `${siteUrl}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.8 }, ...posts];
}
