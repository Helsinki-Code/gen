import fs from "node:fs";
import path from "node:path";
import { markdownToHtml } from "@/lib/markdown";

const copyPath = path.resolve(process.cwd(), "..", "docs", "all_pages_copy.md");

const pageNumberBySlug: Record<string, number> = {
  "/": 1,
  "/pricing": 2,
  "/about": 3,
  "/features/lead-generation": 4,
  "/features/ai-sequences": 5,
  "/features/multi-channel-outreach": 6,
  "/developers": 7,
  "/alternatives/apollo-alternative": 8,
  "/alternatives/clay-alternative": 9,
  "/alternatives/instantly-alternative": 10,
  "/alternatives/lemlist-alternative": 11,
  "/ai-sdr-tools": 12,
};

function getPageBlock(pageNumber: number) {
  if (!fs.existsSync(copyPath)) return "";
  const markdown = fs.readFileSync(copyPath, "utf8");
  const start = markdown.search(new RegExp(`^# PAGE ${pageNumber} `, "m"));
  if (start < 0) return "";
  const rest = markdown.slice(start);
  const next = rest.search(new RegExp(`\\n# PAGE ${pageNumber + 1} `));
  return next >= 0 ? rest.slice(0, next) : rest;
}

function stripFrontMatter(block: string) {
  const heroIndex = block.search(/^## HERO\s*$/m);
  if (heroIndex < 0) return block;

  const nextSectionIndex = block.slice(heroIndex + 1).search(/\n##\s+(?!HERO\b)/);
  if (nextSectionIndex < 0) return block.slice(heroIndex);
  return block.slice(heroIndex + 1 + nextSectionIndex + 1);
}

function cleanCopy(block: string) {
  return block
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return (
        trimmed !== "---" &&
        !/^# PAGE \d+/.test(trimmed) &&
        !/^\*\*(URL|Meta title|Meta description|Primary keyword|Secondary keywords|H1 keyword intent):\*\*/i.test(trimmed) &&
        !/^\*Annotation:/i.test(trimmed)
      );
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function getPageCopyHtml(slug: string) {
  const pageNumber = pageNumberBySlug[slug];
  if (!pageNumber) return "";
  const block = getPageBlock(pageNumber);
  if (!block) return "";
  return markdownToHtml(cleanCopy(stripFrontMatter(block)));
}
