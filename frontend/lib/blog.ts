import fs from "node:fs";
import path from "node:path";
import { markdownToHtml } from "@/lib/markdown";

export type BlogPost = {
  slug: string;
  fileName: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  primaryKeyword: string;
  secondaryKeywords: string;
  markdown: string;
  html: string;
  excerpt: string;
  images: { src: string; alt: string }[];
  audioUrl: string | null;
  faqs: { question: string; answer: string }[];
};

const docsDir = path.resolve(process.cwd(), "..", "docs", "latest");
const publicAudioDir = path.resolve(process.cwd(), "public", "assets", "article-audio");

function fileToSlug(fileName: string) {
  return fileName.replace(/\.md$/, "").replace(/^\d+-/, "");
}

function readMeta(markdown: string, label: string) {
  const match = markdown.match(new RegExp(`^\\*\\*${label}:\\*\\*\\s*(.+)$`, "im"));
  return match?.[1]?.trim() || "";
}

function readTitle(markdown: string) {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || "AmroGen article";
}

function readImages(markdown: string) {
  const images: { src: string; alt: string }[] = [];
  for (const match of markdown.matchAll(/!\[([^\]]*)]\(([^)]+)\)/g)) {
    const src = match[2].startsWith("./assets/")
      ? `/blog-assets/${match[2].replace("./assets/", "")}`
      : match[2];
    images.push({ alt: match[1], src });
  }
  return images;
}

function stripMarkdown(value: string) {
  return value
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function readFaqs(markdown: string) {
  const faqStart = markdown.search(/^##\s+FAQ/m);
  if (faqStart < 0) return [];
  const faqBlock = markdown.slice(faqStart);
  const matches = [...faqBlock.matchAll(/\*\*([^*?]+\?)\*\*\s*\n([\s\S]*?)(?=\n\*\*[^*?]+\?\*\*|\n##\s+|\n---|\n\*Data reflects|$)/g)];
  return matches
    .map((match) => ({
      question: stripMarkdown(match[1]),
      answer: stripMarkdown(match[2].replace(/\n+/g, " ")),
    }))
    .filter((faq) => faq.question && faq.answer);
}

function readAudioUrl(slug: string) {
  if (!fs.existsSync(publicAudioDir)) return null;
  const audio = fs
    .readdirSync(publicAudioDir)
    .filter((file) => file.startsWith(`${slug}-`) && /\.(mp3|wav)$/i.test(file))
    .sort()
    .at(-1);
  return audio ? `/article-audio/${audio}` : null;
}

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(docsDir)) return [];
  return fs
    .readdirSync(docsDir)
    .filter((file) => /^\d+-.+\.md$/.test(file))
    .sort()
    .map((fileName) => {
      const markdown = fs.readFileSync(path.join(docsDir, fileName), "utf8");
      const title = readTitle(markdown);
      const metaDescription = readMeta(markdown, "Meta Description");
      return {
        slug: fileToSlug(fileName),
        fileName,
        title,
        metaTitle: readMeta(markdown, "Meta Title") || title,
        metaDescription,
        primaryKeyword: readMeta(markdown, "Primary keyword"),
        secondaryKeywords: readMeta(markdown, "Secondary keywords"),
        markdown,
        html: markdownToHtml(markdown),
        excerpt: metaDescription || stripMarkdown(markdown.split("\n\n")[1] || ""),
        images: readImages(markdown),
        audioUrl: readAudioUrl(fileToSlug(fileName)),
        faqs: readFaqs(markdown),
      };
    });
}

export function getPost(slug: string) {
  return getAllPosts().find((post) => post.slug === slug);
}
