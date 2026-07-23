import fs from "node:fs";
import path from "node:path";
import { getAllPosts } from "@/lib/blog";
import { isAdminEmail } from "@/lib/admin";
import { auth } from "@/lib/auth/server";
import { publicMarketingPaths } from "@/lib/marketing-content";

export const docsDir = path.resolve(process.cwd(), "..", "docs", "latest");
const draftsDir = path.join(docsDir, "drafts");
const workflowFile = path.join(draftsDir, "workflow.json");
const scheduleFile = path.join(draftsDir, "article-schedule.json");
const schedulerRunFile = path.join(draftsDir, "scheduler-run.json");
const strategyFile = path.resolve(process.cwd(), "..", "docs", "amrogen-seo-strategy.csv");
const contextFile = path.resolve(process.cwd(), "..", "docs", "product-marketing-context.md");
const docsAssetsDir = path.join(docsDir, "assets");
const publicAssetsDir = path.resolve(process.cwd(), "public", "assets", "blog");
const publicAudioDir = path.resolve(process.cwd(), "public", "assets", "article-audio");

type StrategyRow = Record<string, string>;

export type ArticleDraft = {
  id: string;
  slug: string;
  fileName: string;
  title: string;
  keyword: string;
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
  wordCount: number;
  imageCount: number;
  sourceKeyword: string;
  assets?: ArticleAsset[];
  versions?: ArticleVersion[];
  audioFileName?: string;
  audioMimeType?: string;
  publicPath?: string;
};

export type ArticleAsset = {
  id: string;
  type: "feature" | "content";
  fileName: string;
  alt: string;
  prompt: string;
  creativeBrief?: string;
  placementMarker?: string;
  createdAt: string;
};

export type ArticleVersion = {
  id: string;
  label: string;
  fileName: string;
  createdAt: string;
  wordCount: number;
  note?: string;
};

export type DraftMetrics = {
  wordCount: number;
  readingTimeMinutes: number;
  readabilityScore: number;
  readabilityLabel: string;
  keywordDensity: number;
  externalLinkCount: number;
  internalLinkCount: number;
};

export type ArticleSchedule = {
  enabled: boolean;
  cadence: "hourly" | "six_hours" | "daily";
  articlesPerRun: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
};

type WorkflowState = {
  drafts: ArticleDraft[];
  schedule: ArticleSchedule;
  notifications: Array<{
    id: string;
    subject: string;
    message: string;
    createdAt: string;
    delivered: boolean;
  }>;
};

type SchedulerRunState = {
  runId: string;
  status: "running" | "stopping";
  startedAt: string;
};

let activeSchedulerController: AbortController | null = null;

class SchedulerStoppedError extends Error {
  constructor() {
    super("Article scheduler stopped by an admin.");
    this.name = "SchedulerStoppedError";
  }
}

function isPublishedArticleId(id: string) {
  return id.startsWith("published:");
}

function publishedSlugFromId(id: string) {
  return id.replace(/^published:/, "");
}

const defaultSchedule: ArticleSchedule = {
  enabled: false,
  cadence: "daily",
  articlesPerRun: 1,
  lastRunAt: null,
  nextRunAt: null,
};

function writeJsonAtomic(filePath: string, value: unknown) {
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(value, null, 2));
  fs.renameSync(temporaryPath, filePath);
}

// fs.copyFileSync uses copy syscalls (copy_file_range/ficlone) that the GCS
// FUSE mount backing /docs in production rejects with EPERM — copy via
// read+write instead.
function copyFileCompat(sourcePath: string, destinationPath: string) {
  fs.writeFileSync(destinationPath, fs.readFileSync(sourcePath));
}

function readSchedulerRunState(): SchedulerRunState | null {
  try {
    return JSON.parse(fs.readFileSync(schedulerRunFile, "utf8")) as SchedulerRunState;
  } catch {
    return null;
  }
}

function assertSchedulerActive(runId: string, signal: AbortSignal) {
  const state = readSchedulerRunState();
  if (signal.aborted || !state || state.runId !== runId || state.status === "stopping") {
    throw new SchedulerStoppedError();
  }
}

export function getSchedulerRunStatus() {
  const state = readSchedulerRunState();
  return {
    running: Boolean(state),
    stopping: state?.status === "stopping",
    startedAt: state?.startedAt || null,
  };
}

export function stopActiveScheduler() {
  const state = readSchedulerRunState();
  if (!state) return { stopped: false, message: "No scheduler run is active." };
  writeJsonAtomic(schedulerRunFile, { ...state, status: "stopping" });
  activeSchedulerController?.abort();
  try {
    fs.unlinkSync(schedulerRunFile);
  } catch {}
  return { stopped: true, message: "Scheduler stop requested." };
}

function ensureDraftStorage() {
  fs.mkdirSync(draftsDir, { recursive: true });
  fs.mkdirSync(docsAssetsDir, { recursive: true });
  fs.mkdirSync(publicAssetsDir, { recursive: true });
  fs.mkdirSync(publicAudioDir, { recursive: true });
  if (!fs.existsSync(workflowFile)) {
    writeWorkflow({ drafts: [], schedule: defaultSchedule, notifications: [] });
  }
  if (!fs.existsSync(scheduleFile)) {
    let migratedSchedule = defaultSchedule;
    try {
      const workflow = JSON.parse(fs.readFileSync(workflowFile, "utf8")) as Partial<WorkflowState>;
      if (workflow.schedule) migratedSchedule = { ...defaultSchedule, ...workflow.schedule };
    } catch {}
    writeJsonAtomic(scheduleFile, migratedSchedule);
  }
}

function readWorkflow(): WorkflowState {
  ensureDraftStorage();
  try {
    return JSON.parse(fs.readFileSync(workflowFile, "utf8")) as WorkflowState;
  } catch {
    return { drafts: [], schedule: defaultSchedule, notifications: [] };
  }
}

function writeWorkflow(state: WorkflowState) {
  fs.mkdirSync(draftsDir, { recursive: true });
  writeJsonAtomic(workflowFile, state);
}

function readSchedule(): ArticleSchedule {
  ensureDraftStorage();
  try {
    const stored = JSON.parse(fs.readFileSync(scheduleFile, "utf8")) as Partial<ArticleSchedule>;
    const schedule: ArticleSchedule = {
      ...defaultSchedule,
      ...stored,
      articlesPerRun: Math.max(1, Math.min(Number(stored.articlesPerRun || 1), 5)),
    };
    if (schedule.enabled && !schedule.nextRunAt) {
      schedule.nextRunAt = nextRunDate(schedule.cadence);
      writeSchedule(schedule);
    }
    return schedule;
  } catch {
    writeSchedule(defaultSchedule);
    return { ...defaultSchedule };
  }
}

function writeSchedule(schedule: ArticleSchedule) {
  fs.mkdirSync(draftsDir, { recursive: true });
  writeJsonAtomic(scheduleFile, schedule);
}

export async function requireAdminSession() {
  const { data } = await auth.getSession();
  const user = data?.user;
  if (!user || !isAdminEmail(user.email)) {
    return null;
  }
  return user;
}

export function stripMarkdown(value: string) {
  return value
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[*_`>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function wordCount(markdown: string) {
  return stripMarkdown(markdown).split(/\s+/).filter(Boolean).length;
}

function imageCount(markdown: string) {
  return [...markdown.matchAll(/!\[([^\]]*)]\(([^)]+)\)/g)].length;
}

function assetsFromMarkdown(markdown: string, keyword = "", title = ""): ArticleAsset[] {
  const now = new Date().toISOString();
  return [...markdown.matchAll(/!\[([^\]]*)]\(([^)]+)\)/g)].map((match, index) => {
    const href = match[2];
    const alt = match[1] || "AmroGen article image";
    const fileName = href.startsWith("./assets/")
      ? href.replace("./assets/", "")
      : path.basename(href);
    return {
      id: fileName || `image-${index + 1}`,
      type: index === 0 ? "feature" : "content",
      fileName,
      alt,
      prompt: buildArticleImagePrompt({
        type: index === 0 ? "feature" : "content",
        keyword: keyword || alt,
        title: title || alt,
        section: index === 0 ? undefined : alt,
      }),
      createdAt: now,
    };
  });
}

function linkCount(markdown: string, internal: boolean) {
  return [...markdown.matchAll(/\[([^\]]+)]\(([^)]+)\)/g)].filter((match) => {
    const href = match[2];
    const isInternal = href.startsWith("/") || href.includes("amrogen.com");
    return internal ? isInternal : /^https?:\/\//.test(href) && !href.includes("amrogen.com");
  }).length;
}

function syllables(word: string) {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!cleaned) return 0;
  const groups = cleaned.match(/[aeiouy]+/g)?.length || 1;
  return Math.max(1, cleaned.endsWith("e") ? groups - 1 : groups);
}

export function calculateDraftMetrics(markdown: string, keyword = ""): DraftMetrics {
  const plain = stripMarkdown(markdown);
  const words = plain.split(/\s+/).filter(Boolean);
  const sentences = plain.split(/[.!?]+/).filter((item) => item.trim().length > 0);
  const wordTotal = Math.max(words.length, 1);
  const sentenceTotal = Math.max(sentences.length, 1);
  const totalSyllables = words.reduce((sum, word) => sum + syllables(word), 0);
  const flesch = 206.835 - 1.015 * (wordTotal / sentenceTotal) - 84.6 * (totalSyllables / wordTotal);
  const score = Math.round(Math.max(0, Math.min(100, flesch)));
  const keywordPattern = keyword
    ? new RegExp(`\\b${keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g")
    : null;
  const keywordHits = keywordPattern ? (plain.toLowerCase().match(keywordPattern) || []).length : 0;

  return {
    wordCount: words.length,
    readingTimeMinutes: Math.max(1, Math.ceil(words.length / 220)),
    readabilityScore: score,
    readabilityLabel: score >= 70 ? "Easy" : score >= 50 ? "Moderate" : "Complex",
    keywordDensity: Number(((keywordHits / wordTotal) * 100).toFixed(2)),
    externalLinkCount: linkCount(markdown, false),
    internalLinkCount: linkCount(markdown, true),
  };
}

function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const [headers = [], ...records] = rows;
  return records.map((record) =>
    headers.reduce<StrategyRow>((acc, header, index) => {
      acc[header.trim()] = (record[index] || "").trim();
      return acc;
    }, {})
  );
}

export function getStrategyRows() {
  if (!fs.existsSync(strategyFile)) return [];
  const publicKeywords = new Set(getAllPosts().map((post) => post.primaryKeyword.toLowerCase()));
  const workflow = readWorkflow();
  const draftedKeywords = new Set(workflow.drafts.map((draft) => draft.sourceKeyword.toLowerCase()));

  return parseCsv(fs.readFileSync(strategyFile, "utf8")).map((row, index) => ({
    id: `${index + 1}`,
    keyword: row.Keyword || "",
    kd: row.KD || "",
    volume: row.Volume || "",
    category: row.Category || "",
    ctrTitle: row["CTR Title"] || "",
    metaDescription: row["Meta Description"] || "",
    intent: row.Intent || "",
    opportunityScore: row["Opportunity Score"] || "",
    status: publicKeywords.has((row.Keyword || "").toLowerCase())
      ? "published"
      : draftedKeywords.has((row.Keyword || "").toLowerCase())
        ? "draft"
        : "available",
    row,
  }));
}

const STRATEGY_HEADERS = [
  "Keyword",
  "KD",
  "Volume",
  "Category",
  "CTR Title",
  "Meta Description",
  "Content Strategy",
  "Internal Links",
  "Snippet Target",
  "SERP Analysis",
  "AI Overview",
  "Top Competitors",
  "People Also Ask",
  "Intent",
  "Opportunity Score",
  "Strategic Insight",
];

function csvEscape(value: string) {
  const cleaned = value.replace(/\r?\n/g, " ").trim();
  return /[",]/.test(cleaned) ? `"${cleaned.replace(/"/g, '""')}"` : cleaned;
}

function appendStrategyRows(rows: StrategyRow[]) {
  const existing = fs.existsSync(strategyFile) ? fs.readFileSync(strategyFile, "utf8") : "";
  const base = existing.trim()
    ? existing.replace(/\r?\n*$/, "\n")
    : `${STRATEGY_HEADERS.join(",")}\n`;
  const lines = rows.map((row) =>
    STRATEGY_HEADERS.map((header) => csvEscape(String(row[header] || ""))).join(",")
  );
  fs.writeFileSync(strategyFile, `${base}${lines.join("\n")}\n`);
}

export async function generateKeywordIdeas(topic: string, count: number) {
  const existingKeywords = getStrategyRows()
    .map((row) => row.keyword)
    .filter(Boolean);
  const context = fs.existsSync(contextFile) ? fs.readFileSync(contextFile, "utf8").slice(0, 12000) : "";

  const prompt = `You are AmroGen's senior SEO strategist. Research and propose ${count} NEW high-opportunity keywords for AmroGen's blog, using Google Search to validate real SERPs, ranking competitors, and People Also Ask questions before committing to each suggestion.

Product context:
${context}

${topic ? `Focus area requested by the admin: ${topic}` : "Focus on AmroGen's core themes: AI SDR, B2B lead generation, cold email outreach, sales automation, and closely adjacent buyer problems."}

Keywords already covered (never repeat or closely duplicate any of these):
${existingKeywords.join("; ") || "(none yet)"}

Selection criteria:
- Commercial or high-buyer-intent informational queries a B2B SaaS buyer would actually search in 2026.
- Prefer mid/long-tail keywords where one focused, deeply useful article can realistically outrank incumbents (estimated KD under ~40).
- Each suggestion must target a different search intent and topic — no cannibalization between suggestions or with the covered list.

Return STRICT JSON only: an array of ${count} objects, each with exactly these string keys:
"Keyword" - the search query, lowercase.
"KD" - estimated keyword difficulty 0-100.
"Volume" - estimated monthly US search volume.
"Category" - one short category label.
"CTR Title" - click-optimized title under 60 characters, keyword front-loaded.
"Meta Description" - 150-160 characters including the keyword and a concrete reason to click.
"Content Strategy" - 2-3 sentences: angle, format, and how the article beats what ranks today.
"Internal Links" - 2-4 relevant AmroGen topics from the covered list, comma-separated.
"Snippet Target" - the featured-snippet format to win (paragraph, list, or table) and the exact question to answer.
"SERP Analysis" - 1-2 sentences on who ranks today and their weakness.
"AI Overview" - whether AI Overviews appear for this query and how AmroGen gets cited.
"Top Competitors" - 2-4 currently ranking domains, comma-separated.
"People Also Ask" - 3-5 real PAA questions, semicolon-separated.
"Intent" - one of: informational, commercial, transactional, navigational.
"Opportunity Score" - 1-10.
"Strategic Insight" - one sharp sentence on why this keyword wins for AmroGen.
No markdown fences, no commentary - the JSON array only.`;

  const text = await callGeminiText(prompt, 0.85);
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) throw new Error("Keyword machine returned no parseable keyword list.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("Keyword machine returned malformed JSON. Try again.");
  }

  const known = new Set(existingKeywords.map((keyword) => keyword.toLowerCase()));
  const rows: StrategyRow[] = [];
  for (const item of Array.isArray(parsed) ? parsed : []) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const keyword = String(record.Keyword || "").trim().toLowerCase();
    if (!keyword || known.has(keyword)) continue;
    const row: StrategyRow = {};
    for (const header of STRATEGY_HEADERS) row[header] = String(record[header] ?? "").trim();
    row.Keyword = keyword;
    if (!row["CTR Title"] || !row["Meta Description"]) continue;
    known.add(keyword);
    rows.push(row);
    if (rows.length >= count) break;
  }
  if (!rows.length) {
    throw new Error("No new keywords were produced — every suggestion duplicated the existing strategy. Try a more specific focus area.");
  }

  appendStrategyRows(rows);
  return rows.map((row) => ({
    keyword: row.Keyword,
    kd: row.KD,
    volume: row.Volume,
    intent: row.Intent,
    opportunityScore: row["Opportunity Score"],
    ctrTitle: row["CTR Title"],
  }));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function nextPublicFileName(slug: string) {
  const existing = getAllPosts()
    .map((post) => post.fileName.match(/^(\d+)-/)?.[1])
    .filter(Boolean)
    .map(Number);
  const next = String((existing.length ? Math.max(...existing) : 0) + 1).padStart(2, "0");
  return `${next}-${slug}.md`;
}

function readEnvValue(name: string) {
  if (process.env[name]) return process.env[name];
  const backendEnv = path.resolve(process.cwd(), "..", "backend", ".env");
  if (!fs.existsSync(backendEnv)) return "";
  const match = fs
    .readFileSync(backendEnv, "utf8")
    .match(new RegExp(`^${name}=([^\\n\\r]*)`, "m"));
  return match?.[1]?.trim() || "";
}

async function callGeminiText(prompt: string, temperature = 0.72, signal?: AbortSignal) {
  const apiKey = readEnvValue("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY is required.");
  const model = readEnvValue("GEMINI_ARTICLE_MODEL") || "gemini-3.1-pro-preview";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: { temperature },
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini request failed: ${detail || response.statusText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini returned no content.");
  return text.replace(/^```(?:markdown|json)?\s*/i, "").replace(/```$/i, "").trim();
}

function liveInternalUrls() {
  const blogPaths = getAllPosts().map((post) => `/blog/${post.slug}`);
  return [...new Set([...publicMarketingPaths, ...blogPaths])];
}

function buildPrompt(row: StrategyRow) {
  const context = fs.existsSync(contextFile) ? fs.readFileSync(contextFile, "utf8").slice(0, 18000) : "";
  const internalUrls = liveInternalUrls();
  return `Write a full-length, research-oriented, editorial-quality SEO article for AmroGen.

Product context:
${context}

Article brief:
- Keyword: ${row.Keyword}
- KD: ${row.KD}
- Volume: ${row.Volume}
- Category: ${row.Category}
- CTR title: ${row["CTR Title"]}
- Meta description: ${row["Meta Description"]}
- Content strategy: ${row["Content Strategy"]}
- Internal links: ${row["Internal Links"]}
- Snippet target: ${row["Snippet Target"]}
- SERP analysis: ${row["SERP Analysis"]}
- AI Overview: ${row["AI Overview"]}
- Top competitors: ${row["Top Competitors"]}
- People Also Ask: ${row["People Also Ask"]}
- Intent: ${row.Intent}
- Opportunity score: ${row["Opportunity Score"]}
- Strategic insight: ${row["Strategic Insight"]}

Requirements:
1. Output Markdown only.
2. Start with one H1 matching the CTR title. Front-load the primary keyword in the H1 and keep it under 60 characters where possible.
3. Include these metadata lines immediately after the H1:
**Meta Title:** ...
**Meta Description:** ...
**Primary keyword:** ...
**Secondary keywords:** ...
Meta Title: under 60 characters, primary keyword first, compelling differentiator second. Meta Description: 150-160 characters, includes the primary keyword and a concrete reason to click.
4. Open the article body with a 40-60 word direct answer to the query behind the primary keyword — a standalone paragraph a search engine could lift verbatim as a featured snippet or AI Overview citation. Follow it with a "Key takeaways" section of 4-6 specific, self-contained bullet points.
5. Write at least 4000 words. Prioritize information gain: original frameworks, specific worked examples with real numbers, decision criteria, edge cases, and buyer nuance that competing articles (see Top Competitors) do not cover. Match the dominant search intent from the brief exactly — if the intent is comparison, lead with comparison; if how-to, lead with steps.
6. Phrase H2 headings as the query variants and People Also Ask questions real searchers use. Open every H2 section with a 2-3 sentence direct answer to that heading before going deep, so each section is independently quotable by search engines and AI assistants.
7. Include at least one Markdown comparison table with concrete, honest criteria (features, pricing model, best-fit team size, limitations). Tables win featured snippets and AI citations.
8. Demonstrate first-hand expertise (E-E-A-T): describe concrete workflows step by step as a practitioner would, name specific tools and their actual capabilities, state honest trade-offs, and ground time-sensitive claims in current (2026) reality using search. Never fabricate statistics, benchmarks, or customer results.
9. Internal linking is mandatory and dense: include 6-10 internal links as markdown links, chosen ONLY from this exact list of live AmroGen URLs (use each path exactly as written, each URL at most once, with descriptive anchor text woven into body sentences — never "click here"):
${internalUrls.join("\n")}
External citations are equally mandatory: include 10-15 authoritative external sources (industry research, official documentation, reputable publications — full https URLs found via search) as contextual markdown links with natural anchor text. Distribute links throughout: every H2 section must contain at least one link, internal or external. An article with fewer than 6 internal or fewer than 10 external links is incomplete. Do not publish a visible SERP-analysis or link-strategy section — use those brief insights invisibly to shape angle and structure.
10. Cover the topic's semantic field: naturally use secondary keywords, synonyms, and related entities. Never stuff the primary keyword — natural language always wins.
11. Include an FAQ section built from People Also Ask, where each answer is 40-55 words, self-contained, and starts with the direct answer (schema- and AI-Overview-ready).
12. Keep paragraphs to 1-3 sentences. Use bulleted lists, numbered steps, and bolded key phrases (sparingly) for scannability.
13. Do not invent screenshots, fake data, fake test results, or image placeholders.
14. Keep AmroGen persuasive but honest about where other tools may be stronger — credibility is the differentiator that earns links and AI citations.
15. Aim for depth, not fluff. Avoid generic AI phrases ("in today's fast-paced world", "game-changer", "delve", "landscape"). End with a conclusion that gives the reader one clear next step.
16. Act as the article's visual commissioning editor. Add 3-5 one-line HTML image-brief comments at the exact places where a visual would materially help the reader. Put one feature brief immediately after the metadata and the others immediately after their relevant H2 sections. Use this exact format:
<!-- AMROGEN_IMAGE_BRIEF {"id":"feature","role":"feature","alt":"specific accessible alt text","prompt":"80-160 word art-directed image prompt"} -->
Use unique ids and role "content" for in-article visuals. Every prompt must be specific to the nearby argument and choose its own best visual metaphor or information design (for example a decision map, process, comparison, layered system, editorial scene, or data relationship). Describe focal point, composition, hierarchy, useful labels, and what must not be invented. Do not write generic SaaS infographic prompts, repeat one visual template, or add Markdown image syntax—the application will generate and insert each commissioned image in the next step.`;
}

async function generateMarkdown(row: StrategyRow, signal?: AbortSignal) {
  return callGeminiText(buildPrompt(row), 0.75, signal);
}

function articleHeadings(markdown: string) {
  return [...markdown.matchAll(/^##\s+(.+)$/gm)].map((match) =>
    match[1].replace(/\{#[^}]+}/g, "").trim()
  );
}

const AMROGEN_IMAGE_ART_DIRECTION = `
AMROGEN VISUAL SYSTEM
- Premium editorial artwork for a modern B2B SaaS brand: intelligent, precise, credible, and human-led.
- Use deep navy #0B1118 as the dominant canvas, elevated panels in #111A24, AmroGen teal #22D3C5 as the primary signal color, cyan #38BDF8 as the secondary accent, slate #94A3B8 for quiet detail, and off-white for high-contrast highlights.
- Build one unmistakable focal point with a strong foreground/midground/background hierarchy, an asymmetrical but balanced composition, generous negative space, and clean 10% safe margins.
- Preferred visual language: elegant data paths, modular workflow cards, refined charts, precise connector lines, subtle grid texture, restrained glass depth, soft controlled illumination, and crisp editorial geometry.
- Make the image feel art-directed and publication-ready, not like a template. Use realistic material depth and sophisticated lighting while keeping diagrams immediately understandable.

CONTENT AND TEXT RULES
- Communicate one useful idea that directly matches the supplied article context. Choose the clearest visual grammar for it: process flow, comparison, decision map, layered system, or metric narrative.
- Prefer visual storytelling, icons, shapes, and data relationships over written explanation.
- Use no headline, paragraph, logo, watermark, or decorative pseudo-text. If a diagram cannot work without labels, use at most three short labels of one to three words, spelled exactly as supplied — misspelled or garbled text ruins the image, so when in doubt use zero words and let shape, color, and flow carry the meaning.
- Do not invent a literal AmroGen product screenshot, customer result, statistic, testimonial, or interface capability.
- The core subject must read instantly at thumbnail size (roughly 400px wide), since search results, social cards, and the blog index all crop and shrink this image.
- Each image within one article must use a visibly different composition and visual grammar from the others — never repeat the same layout twice in an article.

QUALITY BAR AND EXCLUSIONS
- High-end SaaS editorial campaign quality, sharp at full resolution, cohesive, polished, and suitable for a featured article image.
- Avoid humanoid robots, glowing brains, generic AI circuitry, stock-photo office scenes, handshakes, clip art, toy-like 3D icons, excessive neon, rainbow gradients, cluttered dashboards, tiny text, fake logos, competitor trademarks, and generic blue-purple tech art.
- No border or device mockup around the final image; the composition must fill the frame edge to edge.
- Keep the bottom-right corner free of critical detail — the AmroGen logo is stamped there in post-production.`.trim();

function sectionExcerpt(markdown: string, heading: string) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const section = markdown.match(
    new RegExp(`^##\\s+${escapedHeading}(?:\\s+\\{#[^}]+\\})?\\s*$([\\s\\S]*?)(?=^##\\s+|$)`, "m")
  )?.[1];
  return stripMarkdown(section || "").slice(0, 700);
}

function buildArticleImagePrompt({
  type,
  keyword,
  title,
  section,
  excerpt,
}: {
  type: "feature" | "content";
  keyword: string;
  title: string;
  section?: string;
  excerpt?: string;
}) {
  const purpose = type === "feature"
    ? `Create a stop-scroll editorial hero that expresses the article's central tension and resolution in one confident visual. Show the business problem transforming into a clear, research-led AmroGen workflow and a credible outcome; do not make a text poster. Keep the lower-left third of the frame as calmer negative space — the article headline is overlaid there in post-production, so place the focal subject in the upper-right two-thirds.`
    : `Create an explanatory editorial visual for the named section. Translate the section's actual reasoning into one clear visual relationship rather than producing generic decoration or repeating the feature image.`;

  return `${purpose}

ARTICLE CONTEXT
- Primary keyword: ${keyword}
- Article title: ${title}
${section ? `- Section: ${section}` : ""}
${excerpt ? `- Section meaning: ${excerpt}` : ""}

${AMROGEN_IMAGE_ART_DIRECTION}

OUTPUT
- Landscape 3:2 composition optimized for a 1536x1024 editorial image.
- Keep essential subjects and any rare labels inside the central safe area so responsive crops remain useful.
- Return a single finished image, not multiple options, a mood board, or a collage of drafts.`;
}

function syncAsset(fileName: string, buffer: Buffer) {
  fs.writeFileSync(path.join(docsAssetsDir, fileName), buffer);
  fs.writeFileSync(path.join(publicAssetsDir, fileName), buffer);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapTitleLines(title: string, maxChars = 20) {
  const words = title.toUpperCase().replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
      if (lines.length === 3) break;
    } else {
      line = candidate;
    }
  }
  if (lines.length < 3 && line) lines.push(line);
  else if (lines.length === 3) lines[2] = `${lines[2].slice(0, maxChars - 1)}…`;
  return lines.slice(0, 3);
}

// Thumbnail-style headline: highlight boxes bottom-left, brand palette, last
// line flipped onto AmroGen teal for emphasis. Rendered as SVG and composited
// by sharp — never asked of the image model, which garbles text.
function titleOverlaySvg(title: string, width: number, height: number) {
  const compact = title.length > 46;
  const lines = wrapTitleLines(title.slice(0, 90), compact ? 26 : 20);
  const fontSize = compact ? 52 : 64;
  const rowHeight = compact ? 78 : 92;
  const padX = 26;
  const marginX = 64;
  const blockHeight = lines.length * rowHeight;
  const startY = height - blockHeight - 72;
  const rows = lines
    .map((line, index) => {
      const isAccent = index === lines.length - 1;
      const textWidth = Math.round(line.length * fontSize * 0.62);
      const y = startY + index * rowHeight;
      const boxFill = isAccent ? "#22D3C5" : "rgba(11,17,24,0.88)";
      const textFill = isAccent ? "#0B1118" : "#FFFFFF";
      return `<rect x="${marginX}" y="${y}" width="${textWidth + padX * 2}" height="${rowHeight - 14}" rx="8" fill="${boxFill}"/>
<text x="${marginX + padX}" y="${y + rowHeight - Math.round(fontSize * 0.62)}" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold" font-size="${fontSize}" letter-spacing="1" fill="${textFill}">${escapeXml(line)}</text>`;
    })
    .join("\n");
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
<defs><linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
<stop offset="0.45" stop-color="#0B1118" stop-opacity="0"/>
<stop offset="1" stop-color="#0B1118" stop-opacity="0.55"/>
</linearGradient></defs>
<rect x="0" y="0" width="${width}" height="${height}" fill="url(#scrim)"/>
${rows}
</svg>`;
}

const IMAGE_WIDTH = 1536;
const IMAGE_HEIGHT = 1024;

// Post-generation branding: normalize size, stamp the real AmroGen logo at the
// bottom-right corner, and overlay the article headline on feature images.
async function brandifyImage(buffer: Buffer, overlayTitle?: string): Promise<Buffer> {
  try {
    const sharp = (await import("sharp")).default;
    const composites: { input: Buffer; left: number; top: number }[] = [];

    const normalized = await sharp(buffer)
      .resize(IMAGE_WIDTH, IMAGE_HEIGHT, { fit: "cover" })
      .png()
      .toBuffer();

    // Sample the corner where the logo lands: dark corner gets the
    // light-on-dark logo variant, light corner gets the dark-on-light one.
    const cornerStats = await sharp(normalized)
      .extract({ left: IMAGE_WIDTH - 260, top: IMAGE_HEIGHT - 150, width: 260, height: 150 })
      .greyscale()
      .stats();
    const cornerBrightness = cornerStats.channels[0]?.mean ?? 0;
    const logoVariant = cornerBrightness < 128 ? "amrogen_dark_logo.png" : "amrogen_light_logo.png";

    const logoPath = path.resolve(process.cwd(), "public", "assets", "images", "logo", logoVariant);
    if (fs.existsSync(logoPath)) {
      const logo = await sharp(logoPath).resize({ width: 150 }).png().toBuffer();
      const logoMeta = await sharp(logo).metadata();
      composites.push({
        input: logo,
        left: IMAGE_WIDTH - (logoMeta.width || 150) - 36,
        top: IMAGE_HEIGHT - (logoMeta.height || 44) - 30,
      });
    }
    if (overlayTitle) {
      composites.push({
        input: Buffer.from(titleOverlaySvg(overlayTitle, IMAGE_WIDTH, IMAGE_HEIGHT)),
        left: 0,
        top: 0,
      });
    }

    return await sharp(normalized).composite(composites).png().toBuffer();
  } catch (error) {
    console.error("[brandifyImage] branding failed, using raw image:", error);
    return buffer;
  }
}

type WriterImageBrief = {
  id: string;
  role: "feature" | "content";
  alt: string;
  prompt: string;
  marker: string;
};

function parseWriterImageBriefs(markdown: string): WriterImageBrief[] {
  const briefs: WriterImageBrief[] = [];
  const seen = new Set<string>();
  const pattern = /<!--\s*AMROGEN_IMAGE_BRIEF\s+({[\s\S]*?})\s*-->/g;
  for (const match of markdown.matchAll(pattern)) {
    try {
      const parsed = JSON.parse(match[1]) as Record<string, unknown>;
      const id = slugify(String(parsed.id || ""));
      const role = parsed.role === "feature" ? "feature" : "content";
      const alt = String(parsed.alt || "").trim();
      const prompt = String(parsed.prompt || "").trim();
      if (!id || seen.has(id) || alt.length < 8 || prompt.length < 80) continue;
      seen.add(id);
      briefs.push({ id, role, alt: alt.slice(0, 240), prompt: prompt.slice(0, 3000), marker: match[0] });
    } catch {}
  }
  return briefs.slice(0, 6);
}

function writerCommissionedPrompt(brief: WriterImageBrief, row: StrategyRow) {
  return [
    "WRITER-COMMISSIONED CREATIVE BRIEF",
    brief.prompt,
    "ARTICLE CONTEXT",
    "- Primary keyword: " + row.Keyword,
    "- Article title: " + row["CTR Title"],
    brief.role === "feature"
      ? "LAYOUT RESERVATION: keep the lower-left third of the frame as calmer negative space — the article headline is overlaid there in post-production, so place the focal subject in the upper-right two-thirds."
      : "",
    AMROGEN_IMAGE_ART_DIRECTION,
    "Execute the writer's unique concept faithfully while applying the AmroGen brand system. Return one finished 1536x1024 image with no border, watermark, or alternate drafts.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildImagePlan(markdown: string, row: StrategyRow, slug: string) {
  const writerBriefs = parseWriterImageBriefs(markdown);
  if (writerBriefs.length > 0) {
    return writerBriefs.map((brief, index) => ({
      id: crypto.randomUUID(),
      type: brief.role,
      fileName:
        brief.role === "feature"
          ? slug + "-feature.png"
          : slug + "-" + brief.id + "-" + String(index + 1) + ".png",
      alt: brief.alt,
      creativeBrief: brief.prompt,
      placementMarker: brief.marker,
      prompt: writerCommissionedPrompt(brief, row),
      createdAt: new Date().toISOString(),
    }));
  }

  const headings = articleHeadings(markdown).filter((heading) => !/faq|table of contents/i.test(heading));
  const contentCount = Math.max(2, Math.min(5, Math.ceil(wordCount(markdown) / 1200)));
  const now = new Date().toISOString();
  return [
    {
      id: crypto.randomUUID(),
      type: "feature" as const,
      fileName: `${slug}-feature.png`,
      alt: `${row.Keyword} feature image showing AmroGen AI sales workflow and SEO comparison insight`,
      prompt: buildArticleImagePrompt({
        type: "feature",
        keyword: row.Keyword,
        title: row["CTR Title"],
      }),
      createdAt: now,
    },
    ...headings.slice(0, contentCount).map((heading, index) => ({
      id: crypto.randomUUID(),
      type: "content" as const,
      fileName: `${slug}-visual-${index + 1}.png`,
      alt: `${row.Keyword} infographic explaining ${heading}`,
      prompt: buildArticleImagePrompt({
        type: "content",
        keyword: row.Keyword,
        title: row["CTR Title"],
        section: heading,
        excerpt: sectionExcerpt(markdown, heading),
      }),
      createdAt: now,
    })),
  ];
}

function buildFreshRegenerationPrompt(
  draft: ArticleDraft,
  asset: ArticleAsset,
  markdown: string
) {
  let section: string | undefined;
  if (asset.type === "content") {
    const imagePosition = markdown.indexOf(asset.fileName);
    if (imagePosition >= 0) {
      const precedingHeadings = articleHeadings(markdown.slice(0, imagePosition));
      section = precedingHeadings.at(-1);
    }
    section ||= asset.alt;
  }

  if (asset.creativeBrief) {
    return [
      "WRITER-COMMISSIONED CREATIVE BRIEF",
      asset.creativeBrief,
      "CURRENT ARTICLE CONTEXT",
      "- Primary keyword: " + (draft.keyword || draft.sourceKeyword || draft.slug.replace(/-/g, " ")),
      "- Article title: " + draft.title,
      section ? "- Section: " + section : "",
      section ? "- Current section meaning: " + sectionExcerpt(markdown, section) : "",
      AMROGEN_IMAGE_ART_DIRECTION,
      "Regenerate the image as a fresh execution of this same unique editorial concept. Improve clarity, composition, and professional finish without collapsing it into a generic reusable template.",
    ].filter(Boolean).join("\n\n");
  }

  return buildArticleImagePrompt({
    type: asset.type,
    keyword: draft.keyword || draft.sourceKeyword || draft.slug.replace(/-/g, " "),
    title: draft.title,
    section,
    excerpt: section ? sectionExcerpt(markdown, section) : undefined,
  });
}

export async function regenerateDraftImage(draftId: string, assetId: string, feedback = "") {
  const { state, draft } = articleById(draftId);
  const asset = draft.assets?.find((item) => item.id === assetId);
  if (!asset) throw new Error("Image asset not found.");
  const markdown = readDraftMarkdown(draft);
  // Always rebuild from the current art direction and article context. Drafts
  // created before a prompt update may still contain a stale persisted prompt.
  asset.prompt = buildFreshRegenerationPrompt(draft, asset, markdown);
  await generateOpenAIImage(asset, feedback, undefined, draft.title || draft.keyword);
  asset.createdAt = new Date().toISOString();
  draft.updatedAt = asset.createdAt;
  if (!isPublishedArticleId(draft.id)) writeWorkflow(state);
  return asset;
}

async function generateOpenAIImage(
  asset: ArticleAsset,
  feedback = "",
  signal?: AbortSignal,
  overlayTitle?: string
) {
  const apiKey = readEnvValue("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for image generation.");
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: readEnvValue("OPENAI_IMAGE_MODEL") || "gpt-image-2",
      prompt: `${asset.prompt}${feedback ? `\nAdmin feedback: ${feedback}` : ""}`,
      size: readEnvValue("OPENAI_IMAGE_SIZE") || "1536x1024",
      n: 1,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Image generation failed: ${detail || response.statusText}`);
  }
  const data = await response.json();
  const b64 = data?.data?.[0]?.b64_json;
  const url = data?.data?.[0]?.url;
  const buffer = b64
    ? Buffer.from(b64, "base64")
    : url
      ? Buffer.from(await (await fetch(url, { signal })).arrayBuffer())
      : null;
  if (!buffer) throw new Error("Image generation returned no asset.");
  const branded = await brandifyImage(buffer, asset.type === "feature" ? overlayTitle : undefined);
  syncAsset(asset.fileName, branded);
}

async function generateArticleImages(
  markdown: string,
  row: StrategyRow,
  slug: string,
  scheduler?: { runId: string; signal: AbortSignal }
) {
  const assets = buildImagePlan(markdown, row, slug);
  const overlayTitle = row["CTR Title"] || row.Keyword || "";
  for (const asset of assets) {
    if (scheduler) assertSchedulerActive(scheduler.runId, scheduler.signal);
    await generateOpenAIImage(asset, "", scheduler?.signal, overlayTitle);
  }
  return assets;
}

function insertImages(markdown: string, assets: ArticleAsset[]) {
  const feature = assets.find((asset) => asset.type === "feature");
  let next = markdown;
  for (const asset of assets) {
    if (!asset.placementMarker || !next.includes(asset.placementMarker)) continue;
    const imageMarkdown = "![" + asset.alt + "](./assets/" + asset.fileName + ")";
    next = next.replace(asset.placementMarker, imageMarkdown);
  }
  if (feature && !next.includes(feature.fileName)) {
    next = next.replace(/^(#\s+.+)$/m, `$1\n\n![${feature.alt}](./assets/${feature.fileName})`);
  }
  const contentAssets = assets.filter((asset) => asset.type === "content");
  const headings = [...next.matchAll(/^##\s+(.+)$/gm)];
  const pendingAssets = contentAssets.filter((asset) => !next.includes(asset.fileName));
  const insertions = pendingAssets
    .map((asset, index) => {
      const heading = headings[index + 1] || headings[index];
      return heading?.index === undefined
        ? null
        : {
            insertionPoint: heading.index + heading[0].length,
            markdown: `\n\n![${asset.alt}](./assets/${asset.fileName})\n`,
          };
    })
    .filter((item): item is { insertionPoint: number; markdown: string } => Boolean(item))
    .sort((a, b) => b.insertionPoint - a.insertionPoint);

  // Apply from the end so earlier insertions cannot invalidate later offsets.
  for (const insertion of insertions) {
    next = `${next.slice(0, insertion.insertionPoint)}${insertion.markdown}${next.slice(insertion.insertionPoint)}`;
  }

  if (insertions.length < pendingAssets.length) {
    for (const asset of pendingAssets.slice(insertions.length)) {
      next += `\n\n![${asset.alt}](./assets/${asset.fileName})\n`;
    }
  }
  next = next.replace(/<!--\s*AMROGEN_IMAGE_BRIEF\s+{[\s\S]*?}\s*-->/g, "");
  return next;
}

async function notifyAdmins(subject: string, message: string) {
  const resendApiKey = readEnvValue("RESEND_API_KEY");
  const to = ["vikram@vranceflex.online", "info@agentic-ai.ltd"];
  let delivered = false;

  if (resendApiKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: readEnvValue("ARTICLE_NOTIFY_FROM") || "AmroGen <onboarding@resend.dev>",
        to,
        subject,
        html: `<div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#0B1118"><h2>${subject}</h2><p>${message}</p><p>Open the AmroGen admin dashboard to review and approve.</p></div>`,
      }),
    });
    delivered = response.ok;
  }

  // Read after the network call so an approval made while email is sending is preserved.
  const state = readWorkflow();
  state.notifications.unshift({
    id: crypto.randomUUID(),
    subject,
    message,
    createdAt: new Date().toISOString(),
    delivered,
  });
  state.notifications = state.notifications.slice(0, 30);
  writeWorkflow(state);
}

export async function createArticleDrafts(
  count: number,
  keyword?: string,
  scheduler?: { runId: string; signal: AbortSignal }
) {
  const rows = getStrategyRows()
    .filter((item) => item.status !== "published" && item.status !== "draft")
    .filter((item) => !keyword || item.keyword === keyword)
    .slice(0, Math.max(1, Math.min(count, 5)));

  if (!rows.length) {
    return [];
  }

  const created: ArticleDraft[] = [];

  for (const item of rows) {
    if (scheduler) assertSchedulerActive(scheduler.runId, scheduler.signal);
    let markdown = await generateMarkdown(item.row, scheduler?.signal);
    if (scheduler) assertSchedulerActive(scheduler.runId, scheduler.signal);
    const slug = slugify(item.keyword || item.ctrTitle);
    const assets = await generateArticleImages(markdown, item.row, slug, scheduler);
    if (scheduler) assertSchedulerActive(scheduler.runId, scheduler.signal);
    markdown = insertImages(markdown, assets);
    const id = crypto.randomUUID();
    const fileName = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug}.md`;
    fs.writeFileSync(path.join(draftsDir, fileName), markdown);
    const now = new Date().toISOString();
    const draft: ArticleDraft = {
      id,
      slug,
      fileName,
      title: item.ctrTitle || item.keyword,
      keyword: item.keyword,
      status: "draft",
      createdAt: now,
      updatedAt: now,
      wordCount: wordCount(markdown),
      imageCount: imageCount(markdown),
      sourceKeyword: item.keyword,
      assets,
      versions: [],
    };
    created.push(draft);
  }

  if (scheduler) assertSchedulerActive(scheduler.runId, scheduler.signal);

  // Generation can take several minutes. Merge into the latest state so that
  // schedule or approval changes made while it ran are never overwritten.
  const latestState = readWorkflow();
  const createdIds = new Set(created.map((draft) => draft.id));
  latestState.drafts = [...created, ...latestState.drafts.filter((draft) => !createdIds.has(draft.id))];
  writeWorkflow(latestState);
  await notifyAdmins(
    `${created.length} AmroGen article draft${created.length === 1 ? "" : "s"} ready for review`,
    created.map((draft) => `${draft.title} (${draft.wordCount.toLocaleString()} words)`).join("<br />")
  );
  return created;
}

export function listDrafts() {
  const state = readWorkflow();
  return state.drafts;
}

export function getSchedule() {
  return readSchedule();
}

function nextRunDate(cadence: ArticleSchedule["cadence"], from = new Date()) {
  const ms = cadence === "hourly" ? 60 * 60 * 1000 : cadence === "six_hours" ? 6 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  return new Date(from.getTime() + ms).toISOString();
}

export function saveSchedule(input: Partial<ArticleSchedule>) {
  const current = readSchedule();
  const cadence = input.cadence || current.cadence || "daily";
  const enabled = Boolean(input.enabled);
  const cadenceChanged = cadence !== current.cadence;
  const schedule: ArticleSchedule = {
    enabled,
    cadence,
    articlesPerRun: Math.max(1, Math.min(Number(input.articlesPerRun || current.articlesPerRun || 1), 5)),
    lastRunAt: current.lastRunAt,
    nextRunAt: enabled
      ? !current.enabled || cadenceChanged || !current.nextRunAt
        ? nextRunDate(cadence)
        : current.nextRunAt
      : null,
  };
  writeSchedule(schedule);
  return schedule;
}

export async function runDueSchedule(force = false) {
  const schedule = readSchedule();
  const now = new Date();
  const due = schedule.enabled && (!schedule.nextRunAt || new Date(schedule.nextRunAt) <= now);
  if (!force && !due) {
    return { ran: false, drafts: [], schedule };
  }

  if (readSchedulerRunState()) {
    return { ran: false, alreadyRunning: true, drafts: [], schedule };
  }

  const runId = crypto.randomUUID();
  const controller = new AbortController();
  activeSchedulerController = controller;
  writeJsonAtomic(schedulerRunFile, {
    runId,
    status: "running",
    startedAt: now.toISOString(),
  } satisfies SchedulerRunState);

  try {
    const drafts = await createArticleDrafts(schedule.articlesPerRun, undefined, {
      runId,
      signal: controller.signal,
    });
    assertSchedulerActive(runId, controller.signal);
    const latestSchedule = readSchedule();
    const updatedSchedule: ArticleSchedule = {
      ...latestSchedule,
      lastRunAt: now.toISOString(),
      nextRunAt: latestSchedule.enabled ? nextRunDate(latestSchedule.cadence, now) : null,
    };
    writeSchedule(updatedSchedule);
    return { ran: true, stopped: false, drafts, schedule: updatedSchedule };
  } catch (error) {
    if (
      error instanceof SchedulerStoppedError ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      return { ran: false, stopped: true, drafts: [], schedule: readSchedule() };
    }
    throw error;
  } finally {
    const state = readSchedulerRunState();
    if (state?.runId === runId) {
      try {
        fs.unlinkSync(schedulerRunFile);
      } catch {}
    }
    if (activeSchedulerController === controller) activeSchedulerController = null;
  }
}

export function publishDraft(id: string) {
  const state = readWorkflow();
  const draft = state.drafts.find((item) => item.id === id);
  if (!draft) throw new Error("Draft not found.");
  if (draft.status === "published" && draft.publicPath) return draft;
  const sourcePath = path.join(draftsDir, draft.fileName);
  if (!fs.existsSync(sourcePath)) throw new Error("Draft file is missing.");

  const existingPost = getAllPosts().find((post) => post.slug === draft.slug);
  const publicFileName = existingPost?.fileName || nextPublicFileName(draft.slug);
  copyFileCompat(sourcePath, path.join(docsDir, publicFileName));
  draft.status = "published";
  draft.publicPath = `/blog/${draft.slug}`;
  draft.updatedAt = new Date().toISOString();
  writeWorkflow(state);
  return { ...draft, fileName: publicFileName };
}

function publishedArticleBySlug(slug: string): { state: WorkflowState; draft: ArticleDraft } {
  const post = getAllPosts().find((item) => item.slug === slug || item.fileName === slug);
  if (!post) throw new Error("Published article not found.");
  const state = readWorkflow();
  const workflowDraft = state.drafts.find(
    (item) => item.slug === post.slug && item.status === "published" && item.assets?.length
  );
  const filePath = path.join(docsDir, post.fileName);
  const stats = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
  const audioFileName = post.audioUrl ? path.basename(post.audioUrl) : undefined;
  return {
    state,
    draft: {
      id: `published:${post.slug}`,
      slug: post.slug,
      fileName: post.fileName,
      title: post.title,
      keyword: post.primaryKeyword,
      status: "published",
      createdAt: stats?.birthtime.toISOString() || stats?.mtime.toISOString() || new Date().toISOString(),
      updatedAt: stats?.mtime.toISOString() || new Date().toISOString(),
      wordCount: wordCount(post.markdown),
      imageCount: imageCount(post.markdown),
      sourceKeyword: post.primaryKeyword,
      assets: workflowDraft?.assets || assetsFromMarkdown(post.markdown, post.primaryKeyword, post.title),
      versions: [],
      audioFileName,
      audioMimeType: audioFileName?.endsWith(".mp3") ? "audio/mpeg" : audioFileName ? "audio/wav" : undefined,
      publicPath: `/blog/${post.slug}`,
    },
  };
}

function articleById(id: string) {
  if (isPublishedArticleId(id)) {
    return publishedArticleBySlug(publishedSlugFromId(id));
  }
  const state = readWorkflow();
  const draft = state.drafts.find((item) => item.id === id);
  if (!draft) throw new Error("Draft not found.");
  return { state, draft };
}

function draftById(id: string) {
  return articleById(id);
}

function draftPath(draft: ArticleDraft) {
  if (isPublishedArticleId(draft.id)) return path.join(docsDir, draft.fileName);
  return path.join(draftsDir, draft.fileName);
}

function readDraftMarkdown(draft: ArticleDraft) {
  const filePath = draftPath(draft);
  if (!fs.existsSync(filePath)) throw new Error("Draft file is missing.");
  return fs.readFileSync(filePath, "utf8");
}

function saveDraftVersion(state: WorkflowState, draft: ArticleDraft, label: string, note?: string) {
  const currentPath = draftPath(draft);
  const safeId = draft.id.replace(/[^a-z0-9-]+/gi, "-");
  const versionFileName = `${safeId}-${Date.now()}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`;
  if (fs.existsSync(currentPath)) {
    copyFileCompat(currentPath, path.join(draftsDir, versionFileName));
    if (isPublishedArticleId(draft.id)) return;
    draft.versions = [
      {
        id: crypto.randomUUID(),
        label,
        fileName: versionFileName,
        createdAt: new Date().toISOString(),
        wordCount: draft.wordCount,
        note,
      },
      ...(draft.versions || []),
    ].slice(0, 12);
  }
  writeWorkflow(state);
}

function updateDraftMarkdown(state: WorkflowState, draft: ArticleDraft, markdown: string) {
  fs.writeFileSync(draftPath(draft), markdown);
  draft.updatedAt = new Date().toISOString();
  draft.wordCount = wordCount(markdown);
  draft.imageCount = imageCount(markdown);
  const previousAssets = new Map((draft.assets || []).map((asset) => [asset.fileName, asset]));
  draft.assets = assetsFromMarkdown(markdown, draft.keyword, draft.title).map((asset) => {
    const previous = previousAssets.get(asset.fileName);
    return previous?.creativeBrief
      ? { ...asset, creativeBrief: previous.creativeBrief, prompt: previous.prompt }
      : asset;
  });
  if (!isPublishedArticleId(draft.id)) writeWorkflow(state);
}

export function getDraftDetail(id: string) {
  const { draft } = draftById(id);
  const markdown = readDraftMarkdown(draft);
  return {
    draft,
    markdown,
    metrics: calculateDraftMetrics(markdown, draft.keyword),
    audioUrl: draft.audioFileName ? `/article-audio/${draft.audioFileName}` : null,
  };
}

export async function regenerateDraftArticle(id: string, feedback = "") {
  const { state, draft } = draftById(id);
  const current = readDraftMarkdown(draft);
  saveDraftVersion(state, draft, "Before regeneration", feedback);
  const prompt = `Regenerate this AmroGen SEO article as a stronger 4000+ word version.

Target keyword: ${draft.keyword}
Admin feedback: ${feedback || "Improve depth, SEO competitiveness, SERP differentiation, internal links, and external citations."}

Current article:
${current}

Return only complete Markdown. Preserve useful image markdown references if they still fit. Include 10-15 authoritative external links, strong SERP intent analysis, internal linking strategy, FAQ, and E-E-A-T signals.`;
  const markdown = await callGeminiText(prompt, 0.7);
  updateDraftMarkdown(state, draft, markdown);
  return getDraftDetail(id);
}

export async function improveDraftArticle(id: string, metric: string, feedback = "") {
  const { state, draft } = draftById(id);
  const current = readDraftMarkdown(draft);
  saveDraftVersion(state, draft, `Before ${metric} improvement`, feedback);
  const prompt = `You are an expert SEO editor. Improve only the requested weakness while preserving the article's structure, claims, links, image markdown, and overall message.

Target keyword: ${draft.keyword}
Requested improvement: ${metric}
Admin feedback: ${feedback || "No extra feedback."}

Rules:
- Return the full improved Markdown article only.
- If improving keyword density, make usage natural and avoid stuffing.
- If improving readability, simplify sentence structure and improve transitions.
- If improving external links, add contextual high-authority links naturally.
- If improving internal links, add relevant AmroGen internal links with natural anchors.
- Keep the article near or above 4000 words.

Article:
${current}`;
  const markdown = await callGeminiText(prompt, 0.6);
  updateDraftMarkdown(state, draft, markdown);
  return getDraftDetail(id);
}

export async function generateArticleImagePackage(id: string, feedback = "") {
  const { state, draft } = articleById(id);
  const current = readDraftMarkdown(draft);
  saveDraftVersion(state, draft, "Before image package", feedback);
  const row: StrategyRow = {
    Keyword: draft.keyword || draft.sourceKeyword || draft.slug.replace(/-/g, " "),
    "CTR Title": draft.title,
    "Meta Description": "",
    Category: "",
  };
  const assets = buildImagePlan(current, row, draft.slug).map((asset) => ({
    ...asset,
    prompt: feedback ? `${asset.prompt}\nAdmin feedback: ${feedback}` : asset.prompt,
  }));
  for (const asset of assets) {
    await generateOpenAIImage(asset);
  }
  const markdown = insertImages(current, assets);
  fs.writeFileSync(draftPath(draft), markdown);
  draft.updatedAt = new Date().toISOString();
  draft.wordCount = wordCount(markdown);
  draft.imageCount = imageCount(markdown);
  draft.assets = assets;
  if (!isPublishedArticleId(draft.id)) writeWorkflow(state);
  return getDraftDetail(id);
}

export function suggestInternalLinks(id: string, urls: string[] = []) {
  const { draft } = articleById(id);
  const markdown = readDraftMarkdown(draft);
  const corpus = [
    "/ai-sdr-tools",
    "/pricing",
    "/features/lead-generation",
    "/features/ai-sequences",
    "/features/multi-channel-outreach",
    "/alternatives/apollo-alternative",
    "/alternatives/clay-alternative",
    "/alternatives/instantly-alternative",
    "/alternatives/lemlist-alternative",
    "/developers",
    ...getAllPosts().map((post) => `/blog/${post.slug}`),
    ...urls.filter(Boolean),
  ];
  const plain = stripMarkdown(markdown).toLowerCase();
  return corpus.slice(0, 80).map((url) => {
    const slugWords = url.split("/").filter(Boolean).pop()?.replace(/-/g, " ") || "AmroGen";
    const anchor = plain.includes(slugWords.toLowerCase()) ? slugWords : `learn more about ${slugWords}`;
    return {
      anchorText: anchor,
      url,
      reason: `Relevant to ${draft.keyword} and useful for topical cluster navigation.`,
    };
  });
}

export async function generateDraftAudio(id: string) {
  const { state, draft } = articleById(id);
  const apiKey = readEnvValue("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY is required for article read-aloud audio.");
  const markdown = readDraftMarkdown(draft);
  const transcript = stripMarkdown(markdown).slice(0, 24000);
  const model = readEnvValue("GEMINI_ARTICLE_TTS_MODEL") || readEnvValue("GEMINI_TTS_MODEL") || "gemini-2.5-pro-preview-tts";
  const voiceName = readEnvValue("GEMINI_ARTICLE_TTS_VOICE") || "Leda";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Read the following article as a polished executive voice explainer for AmroGen's website.\n\n## Transcript:\n${transcript}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 1.5,
          responseModalities: ["audio"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
        },
      }),
    }
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini TTS generation failed: ${detail || response.statusText}`);
  }

  const responseText = await response.text();
  const inline = extractInlineAudio(responseText);
  if (!inline?.data) throw new Error("Gemini TTS returned no audio data.");
  const converted = audioBufferFromInlineData(inline.data, inline.mimeType || "");
  const fileName = `${draft.slug}-${Date.now()}.${converted.extension}`;
  fs.writeFileSync(path.join(publicAudioDir, fileName), converted.buffer);
  draft.audioFileName = fileName;
  draft.audioMimeType = converted.mimeType;
  draft.updatedAt = new Date().toISOString();
  if (!isPublishedArticleId(draft.id)) writeWorkflow(state);
  return `/article-audio/${fileName}`;
}

function extractInlineAudio(responseText: string): { data: string; mimeType?: string } | null {
  const candidates: unknown[] = [];
  try {
    candidates.push(JSON.parse(responseText));
  } catch {
    for (const line of responseText.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const payload = trimmed.replace(/^data:\s*/, "");
      if (payload === "[DONE]") continue;
      try {
        candidates.push(JSON.parse(payload));
      } catch {}
    }
  }

  function walk(value: unknown): { data: string; mimeType?: string } | null {
    if (!value || typeof value !== "object") return null;
    if ("inlineData" in value) {
      const inline = (value as { inlineData?: { data?: string; mimeType?: string } }).inlineData;
      if (inline?.data) return { data: inline.data, mimeType: inline.mimeType };
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = walk(item);
        if (found) return found;
      }
      return null;
    }
    for (const item of Object.values(value)) {
      const found = walk(item);
      if (found) return found;
    }
    return null;
  }

  for (const candidate of candidates) {
    const found = walk(candidate);
    if (found) return found;
  }
  return null;
}

function audioBufferFromInlineData(rawData: string, mimeType: string) {
  const raw = Buffer.from(rawData, "base64");
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) {
    return { buffer: raw, extension: "mp3", mimeType: "audio/mpeg" };
  }
  if (mimeType.includes("wav")) {
    return { buffer: raw, extension: "wav", mimeType: "audio/wav" };
  }
  const wavOptions = parseAudioMimeType(mimeType);
  return {
    buffer: Buffer.concat([createWavHeader(raw.length, wavOptions), raw]),
    extension: "wav",
    mimeType: "audio/wav",
  };
}

function parseAudioMimeType(mimeType: string) {
  const [fileType, ...params] = mimeType.split(";").map((item) => item.trim());
  const format = fileType.split("/")[1] || "L16";
  const bits = format.startsWith("L") ? Number.parseInt(format.slice(1), 10) : 16;
  const options = {
    numChannels: 1,
    sampleRate: 24000,
    bitsPerSample: Number.isFinite(bits) ? bits : 16,
  };
  for (const param of params) {
    const [key, value] = param.split("=").map((item) => item.trim());
    if (key === "rate") options.sampleRate = Number.parseInt(value, 10) || options.sampleRate;
  }
  return options;
}

function createWavHeader(
  dataLength: number,
  options: { numChannels: number; sampleRate: number; bitsPerSample: number }
) {
  const byteRate = (options.sampleRate * options.numChannels * options.bitsPerSample) / 8;
  const blockAlign = (options.numChannels * options.bitsPerSample) / 8;
  const buffer = Buffer.alloc(44);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(options.numChannels, 22);
  buffer.writeUInt32LE(options.sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(options.bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataLength, 40);
  return buffer;
}

function crc32(buffer: Buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function zipDate(date = new Date()) {
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

export function createDraftZip(id: string) {
  const { draft } = draftById(id);
  const markdownText = readDraftMarkdown(draft);
  const markdown = Buffer.from(markdownText);
  const manifest = {
    title: draft.title,
    keyword: draft.keyword,
    slug: draft.slug,
    status: draft.status,
    wordCount: wordCount(markdownText),
    images: (draft.assets || []).map((asset) => ({
      fileName: asset.fileName,
      alt: asset.alt,
      type: asset.type,
    })),
    audio: draft.audioFileName
      ? {
          fileName: draft.audioFileName,
          mimeType: draft.audioMimeType || "audio/wav",
          websiteSection: "Voice explainer",
        }
      : null,
  };
  const files: Array<{ name: string; data: Buffer }> = [
    { name: `${draft.slug}.md`, data: markdown },
    { name: "manifest.json", data: Buffer.from(JSON.stringify(manifest, null, 2)) },
    {
      name: "voice-explainer.md",
      data: Buffer.from(
        draft.audioFileName
          ? `# Voice Explainer\n\nThe website renders this generated audio above the approved article.\n\nAudio file: ./audio/${draft.audioFileName}\n`
          : "# Voice Explainer\n\nNo read-aloud audio has been generated for this draft yet.\n"
      ),
    },
  ];
  for (const asset of draft.assets || []) {
    const publicSource = path.join(publicAssetsDir, asset.fileName);
    const docsSource = path.join(docsAssetsDir, asset.fileName);
    const source = fs.existsSync(publicSource) ? publicSource : docsSource;
    if (fs.existsSync(source)) files.push({ name: `assets/${asset.fileName}`, data: fs.readFileSync(source) });
  }
  if (draft.audioFileName) {
    const audioPath = path.join(publicAudioDir, draft.audioFileName);
    if (fs.existsSync(audioPath)) files.push({ name: `audio/${draft.audioFileName}`, data: fs.readFileSync(audioPath) });
  }

  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const { dosTime, dosDate } = zipDate();

  for (const file of files) {
    const name = Buffer.from(file.name);
    const crc = crc32(file.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(file.data.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, file.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(file.data.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + file.data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, ...centralParts, end]);
}
