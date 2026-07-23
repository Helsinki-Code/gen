import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  getSchedule,
  getSchedulerRunStatus,
  getStrategyRows,
  listDrafts,
  requireAdminSession,
  wordCount,
} from "@/lib/admin-articles";
import { getAllPosts } from "@/lib/blog";

const docsDir = path.resolve(process.cwd(), "..", "docs", "latest");

export async function GET() {
  const user = await requireAdminSession();
  if (!user) {
    return NextResponse.json({ detail: "Admin access is required." }, { status: 403 });
  }

  const posts = getAllPosts().map((post) => {
    const filePath = path.join(docsDir, post.fileName);
    const stats = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
    return {
      adminId: `published:${post.slug}`,
      slug: post.slug,
      fileName: post.fileName,
      title: post.title,
      metaTitle: post.metaTitle,
      metaDescription: post.metaDescription,
      primaryKeyword: post.primaryKeyword,
      secondaryKeywords: post.secondaryKeywords,
      imageCount: post.images.length,
      imageSrc: post.images[0]?.src || null,
      imageAlt: post.images[0]?.alt || null,
      faqCount: post.faqs.length,
      wordCount: wordCount(post.markdown),
      updatedAt: stats?.mtime.toISOString() || null,
      publicPath: `/blog/${post.slug}`,
    };
  });

  return NextResponse.json({
    count: posts.length,
    posts,
    drafts: listDrafts(),
    schedule: getSchedule(),
    schedulerRun: getSchedulerRunStatus(),
    strategyRows: getStrategyRows(),
    generatedAt: new Date().toISOString(),
  });
}
