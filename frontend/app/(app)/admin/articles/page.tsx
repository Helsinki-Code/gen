"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Download,
  FileText,
  ImageIcon,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Square,
  Volume2,
  Wand2,
} from "lucide-react";
import AdminGuard from "@/components/AdminGuard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { markdownToHtml } from "@/lib/markdown";

type ArticlePost = {
  adminId: string;
  slug: string;
  fileName: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  primaryKeyword: string;
  secondaryKeywords: string;
  imageCount: number;
  imageSrc: string | null;
  imageAlt: string | null;
  faqCount: number;
  wordCount: number;
  updatedAt: string | null;
  publicPath: string;
};

type ArticleDraft = {
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
  publicPath?: string;
};

type ArticleAsset = {
  id: string;
  type: "feature" | "content";
  fileName: string;
  alt: string;
  prompt: string;
  createdAt: string;
};

type ArticleVersion = {
  id: string;
  label: string;
  fileName: string;
  createdAt: string;
  wordCount: number;
  note?: string;
};

type DraftMetrics = {
  wordCount: number;
  readingTimeMinutes: number;
  readabilityScore: number;
  readabilityLabel: string;
  keywordDensity: number;
  externalLinkCount: number;
  internalLinkCount: number;
};

type DraftDetail = {
  draft: ArticleDraft;
  markdown: string;
  metrics: DraftMetrics;
  audioUrl: string | null;
};

type LinkSuggestion = {
  anchorText: string;
  url: string;
  reason: string;
};

type ArticleSchedule = {
  enabled: boolean;
  cadence: "hourly" | "six_hours" | "daily";
  articlesPerRun: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
};

type StrategyRow = {
  id: string;
  keyword: string;
  kd: string;
  volume: string;
  category: string;
  ctrTitle: string;
  metaDescription: string;
  intent: string;
  opportunityScore: string;
  status: "available" | "draft" | "published";
};

type ArticleResponse = {
  count: number;
  posts: ArticlePost[];
  drafts: ArticleDraft[];
  schedule: ArticleSchedule;
  schedulerRun: {
    running: boolean;
    stopping: boolean;
    startedAt: string | null;
  };
  strategyRows: StrategyRow[];
  generatedAt: string;
};

export default function AdminArticlesPage() {
  return (
    <AdminGuard>
      <ArticleManager />
    </AdminGuard>
  );
}

function ArticleManager() {
  const [data, setData] = useState<ArticleResponse | null>(null);
  const [query, setQuery] = useState("");
  const [selectedKeyword, setSelectedKeyword] = useState("");
  const [generateCount, setGenerateCount] = useState(1);
  const [keywordTopic, setKeywordTopic] = useState("");
  const [keywordCount, setKeywordCount] = useState(3);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleCadence, setScheduleCadence] = useState<ArticleSchedule["cadence"]>("daily");
  const [scheduleCount, setScheduleCount] = useState(1);
  const [selectedDraftId, setSelectedDraftId] = useState("");
  const [draftDetail, setDraftDetail] = useState<DraftDetail | null>(null);
  const [feedback, setFeedback] = useState("");
  const [imageFeedback, setImageFeedback] = useState("");
  const [siteMapInput, setSiteMapInput] = useState("");
  const [suggestions, setSuggestions] = useState<LinkSuggestion[]>([]);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [schedulerRunning, setSchedulerRunning] = useState(false);
  const [stoppingScheduler, setStoppingScheduler] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);
  const scrollToPreviewRef = useRef(false);
  const schedulerRunningRef = useRef(false);

  async function loadArticles() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/articles", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load article inventory");
      const nextData = (await response.json()) as ArticleResponse;
      setData(nextData);
      setScheduleEnabled(nextData.schedule.enabled);
      setScheduleCadence(nextData.schedule.cadence);
      setScheduleCount(nextData.schedule.articlesPerRun);
      setSchedulerRunning(nextData.schedulerRun.running);
      schedulerRunningRef.current = nextData.schedulerRun.running;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load articles");
    } finally {
      setLoading(false);
    }
  }

  async function postJson<T>(url: string, body: Record<string, unknown>) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload.detail;
      throw new Error(
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map((item) => item?.msg || JSON.stringify(item)).join("; ")
            : "Request failed"
      );
    }
    return payload as T;
  }

  async function loadDraftDetail(id: string) {
    if (!id) return;
    const response = await fetch(`/api/admin/articles/drafts/${id}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.detail || "Unable to load draft detail");
    setDraftDetail(payload as DraftDetail);
    try {
      window.localStorage.setItem("amrogen:lastArticleDraft", id);
    } catch {}
  }

  async function previewDraft(id: string) {
    setWorking(`preview-${id}`);
    setError("");
    scrollToPreviewRef.current = true;
    try {
      setSelectedDraftId(id);
      await loadDraftDetail(id);
    } catch (err: unknown) {
      scrollToPreviewRef.current = false;
      setError(err instanceof Error ? err.message : "Unable to load draft preview");
    } finally {
      setWorking("");
    }
  }

  async function generateDrafts() {
    setWorking("generate");
    setGenerationProgress(3);
    setError("");
    setNotice("");
    try {
      const result = await postJson<{ count: number }>("/api/admin/articles/generate", {
        count: generateCount,
        keyword: selectedKeyword || undefined,
      });
      setGenerationProgress(100);
      setNotice(`${result.count} draft${result.count === 1 ? "" : "s"} generated for review.`);
      await loadArticles();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to generate drafts");
    } finally {
      setWorking("");
      window.setTimeout(() => setGenerationProgress(0), 1200);
    }
  }

  async function generateKeywords() {
    setWorking("keywords");
    setError("");
    setNotice("");
    try {
      const result = await postJson<{ count: number; keywords: { keyword: string }[] }>(
        "/api/admin/articles/keywords",
        { topic: keywordTopic || undefined, count: keywordCount }
      );
      const added = result.keywords.map((item) => item.keyword).join(", ");
      setNotice(
        `${result.count} new keyword${result.count === 1 ? "" : "s"} added to the strategy: ${added}. They are now available in the article generator.`
      );
      setKeywordTopic("");
      await loadArticles();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to generate keyword ideas");
    } finally {
      setWorking("");
    }
  }

  async function saveScheduler() {
    setWorking("schedule");
    setError("");
    setNotice("");
    try {
      await postJson("/api/admin/articles/schedule", {
        enabled: scheduleEnabled,
        cadence: scheduleCadence,
        articlesPerRun: scheduleCount,
      });
      setNotice("Article automation schedule saved.");
      await loadArticles();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to save schedule");
    } finally {
      setWorking("");
    }
  }

  async function runScheduler(force = false) {
    if (schedulerRunningRef.current) return;
    let schedulerContinuesElsewhere = false;
    schedulerRunningRef.current = true;
    setSchedulerRunning(true);
    if (force) setWorking("run-now");
    setError("");
    if (!force) setNotice("Scheduled article generation is running in the background.");
    try {
      const result = await postJson<{
        ran: boolean;
        stopped?: boolean;
        alreadyRunning?: boolean;
        drafts: ArticleDraft[];
      }>(
        "/api/admin/articles/run-scheduler",
        { force }
      );
      if (result.ran) {
        setNotice(`${result.drafts.length} scheduled draft${result.drafts.length === 1 ? "" : "s"} generated.`);
        await loadArticles();
      } else if (result.stopped) {
        setNotice("Article scheduler stopped.");
      } else if (result.alreadyRunning) {
        schedulerContinuesElsewhere = true;
        setNotice("The article scheduler is already running.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to run scheduler");
    } finally {
      schedulerRunningRef.current = schedulerContinuesElsewhere;
      setSchedulerRunning(schedulerContinuesElsewhere);
      if (force) setWorking("");
    }
  }

  async function stopScheduler() {
    if (stoppingScheduler) return;
    setStoppingScheduler(true);
    setError("");
    try {
      const result = await postJson<{ stopped: boolean; message: string }>(
        "/api/admin/articles/stop-scheduler",
        {}
      );
      schedulerRunningRef.current = false;
      setSchedulerRunning(false);
      setNotice(result.stopped ? "Article scheduler stopped." : result.message);
      await loadArticles();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to stop scheduler");
    } finally {
      setStoppingScheduler(false);
    }
  }

  async function publishDraft(id: string) {
    setWorking(id);
    setError("");
    setNotice("");
    try {
      await postJson(`/api/admin/articles/drafts/${id}/publish`, {});
      setNotice("Draft approved and published.");
      await loadArticles();
      if (selectedDraftId === id) await loadDraftDetail(id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to publish draft");
    } finally {
      setWorking("");
    }
  }

  async function regenerateArticle() {
    if (!selectedDraftId) return;
    setWorking("regenerate-article");
    setGenerationProgress(5);
    setError("");
    try {
      const detail = await postJson<DraftDetail>(`/api/admin/articles/drafts/${selectedDraftId}/regenerate`, {
        feedback,
      });
      setDraftDetail(detail);
      setNotice("Article regenerated with your feedback.");
      await loadArticles();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to regenerate article");
    } finally {
      setWorking("");
      setGenerationProgress(0);
    }
  }

  async function improveArticle(metric: string) {
    if (!selectedDraftId) return;
    setWorking(`improve-${metric}`);
    setError("");
    try {
      const detail = await postJson<DraftDetail>(`/api/admin/articles/drafts/${selectedDraftId}/improve`, {
        metric,
        feedback,
      });
      setDraftDetail(detail);
      setNotice(`${metric} improved.`);
      await loadArticles();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Unable to improve ${metric}`);
    } finally {
      setWorking("");
    }
  }

  async function regenerateImage(assetId: string) {
    if (!selectedDraftId) return;
    setWorking(assetId);
    setError("");
    try {
      await postJson(`/api/admin/articles/drafts/${selectedDraftId}/images/${assetId}/regenerate`, {
        feedback: imageFeedback,
      });
      setNotice("Image regenerated.");
      await loadDraftDetail(selectedDraftId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to regenerate image");
    } finally {
      setWorking("");
    }
  }

  async function generateImagePackage() {
    if (!selectedDraftId) return;
    setWorking("image-package");
    setError("");
    try {
      const detail = await postJson<DraftDetail>(`/api/admin/articles/drafts/${selectedDraftId}/images`, {
        feedback: imageFeedback,
      });
      setDraftDetail(detail);
      setNotice("Article image package generated and inserted.");
      await loadArticles();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to generate image package");
    } finally {
      setWorking("");
    }
  }

  async function suggestLinks() {
    if (!selectedDraftId) return;
    setWorking("suggest-links");
    setError("");
    try {
      const result = await postJson<{ suggestions: LinkSuggestion[] }>(
        `/api/admin/articles/drafts/${selectedDraftId}/suggest-links`,
        { urls: siteMapInput.split(/\s+/).filter(Boolean) }
      );
      setSuggestions(result.suggestions);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to suggest internal links");
    } finally {
      setWorking("");
    }
  }

  async function generateAudio() {
    if (!selectedDraftId) return;
    setWorking("audio");
    setError("");
    try {
      const result = await postJson<{ audioUrl: string }>(`/api/admin/articles/drafts/${selectedDraftId}/audio`, {});
      setDraftDetail((current) => (current ? { ...current, audioUrl: result.audioUrl } : current));
      setNotice("Article read-aloud audio generated.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to generate audio");
    } finally {
      setWorking("");
    }
  }

  useEffect(() => {
    loadArticles();
  }, []);

  useEffect(() => {
    const schedule = data?.schedule;
    if (!schedule?.enabled || !schedule.nextRunAt) return;
    const delay = Math.max(1000, new Date(schedule.nextRunAt).getTime() - Date.now());
    const timer = window.setTimeout(() => runScheduler(false), delay);
    return () => window.clearTimeout(timer);
  }, [data?.schedule.enabled, data?.schedule.nextRunAt]);

  useEffect(() => {
    if (!draftDetail || !scrollToPreviewRef.current) return;
    scrollToPreviewRef.current = false;
    window.requestAnimationFrame(() => {
      previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [draftDetail]);

  useEffect(() => {
    if (!working.includes("generate") && working !== "regenerate-article") return;
    const interval = window.setInterval(() => {
      setGenerationProgress((current) => Math.min(95, current + 4));
    }, 1200);
    return () => window.clearInterval(interval);
  }, [working]);

  const availableRows = useMemo(
    () => (data?.strategyRows || []).filter((row) => row.status === "available"),
    [data?.strategyRows]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return data?.posts || [];
    return (data?.posts || []).filter((post) =>
      [post.title, post.slug, post.primaryKeyword, post.secondaryKeywords, post.fileName]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [data?.posts, query]);

  const totals = useMemo(() => {
    const posts = data?.posts || [];
    return {
      words: posts.reduce((sum, post) => sum + post.wordCount, 0),
      images: posts.reduce((sum, post) => sum + post.imageCount, 0),
      faqs: posts.reduce((sum, post) => sum + post.faqCount, 0),
      drafts: (data?.drafts || []).filter((draft) => draft.status === "draft").length,
    };
  }, [data?.posts, data?.drafts]);

  const previewHtml = useMemo(
    () => (draftDetail ? markdownToHtml(draftDetail.markdown) : ""),
    [draftDetail?.markdown]
  );

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8 animate-fade-in">
      <div className="mb-7 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-primary">
            <FileText size={16} />
            SEO content operations
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Article Management</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Generate, schedule, review, and publish Markdown-backed SEO articles.
          </p>
        </div>
        <Button variant="secondary" onClick={loadArticles} disabled={loading}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          {loading ? "Refreshing" : "Refresh"}
        </Button>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-5 rounded-lg border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-primary">
          {notice}
        </div>
      )}

      {generationProgress > 0 && (
        <div className="mb-5 rounded-lg border border-primary/20 bg-primary/10 p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-primary">Generating 4000-word article package</span>
            <span className="text-primary">{generationProgress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-background/70">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${generationProgress}%` }} />
          </div>
        </div>
      )}

      {loading && data && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
          <Loader2 size={16} className="animate-spin" />
          Refreshing article inventory…
        </div>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <SummaryCard label="Published" value={data?.count || 0} />
        <SummaryCard label="Drafts" value={totals.drafts} />
        <SummaryCard label="Total words" value={totals.words} />
        <SummaryCard label="Images" value={totals.images} />
      </div>

      <Card elevated className="mb-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary" />
            Keyword Machine
          </CardTitle>
          <CardDescription>
            Researches new high-opportunity keywords with live Google Search grounding and adds fully-briefed rows to the SEO strategy — they appear in the article generator below immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_120px_auto]">
          <div>
            <label className="mb-2 block text-sm font-medium">Focus area (optional)</label>
            <Input
              value={keywordTopic}
              onChange={(event) => setKeywordTopic(event.target.value)}
              placeholder="e.g. cold email deliverability, AI SDR pricing, outbound for agencies — or leave blank for auto-discovery"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Keywords</label>
            <Input
              type="number"
              min={1}
              max={10}
              value={keywordCount}
              onChange={(event) => setKeywordCount(Number(event.target.value))}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={generateKeywords} disabled={Boolean(working) || schedulerRunning}>
              {working === "keywords" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {working === "keywords" ? "Researching…" : "Find keywords"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mb-5 grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <Card elevated>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 size={18} className="text-primary" />
              Bulk Article Generator
            </CardTitle>
            <CardDescription>Creates unpublished drafts from the SEO strategy CSV.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[1fr_120px_auto]">
            <div>
              <label className="mb-2 block text-sm font-medium">Keyword</label>
              <select
                value={selectedKeyword}
                onChange={(event) => setSelectedKeyword(event.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Next available keywords</option>
                {availableRows.map((row) => (
                  <option key={row.id} value={row.keyword}>
                    {row.keyword} - KD {row.kd}, Vol {row.volume}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Count</label>
              <Input
                type="number"
                min={1}
                max={5}
                value={generateCount}
                onChange={(event) => setGenerateCount(Number(event.target.value))}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={generateDrafts} disabled={Boolean(working) || schedulerRunning || availableRows.length === 0}>
                {working === "generate" ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                {schedulerRunning ? "Scheduler running" : "Generate"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card elevated>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock size={18} className="text-primary" />
              Automation Schedule
            </CardTitle>
            <CardDescription>Runs due draft generation while the admin app is active or via cron endpoint.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[auto_1fr_110px_auto_auto]">
            <label className="flex items-center gap-2 rounded-lg border border-border bg-secondary/35 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={scheduleEnabled}
                onChange={(event) => setScheduleEnabled(event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Enabled
            </label>
            <select
              value={scheduleCadence}
              onChange={(event) => setScheduleCadence(event.target.value as ArticleSchedule["cadence"])}
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="hourly">Every hour</option>
              <option value="six_hours">Every 6 hours</option>
              <option value="daily">Daily</option>
            </select>
            <Input
              type="number"
              min={1}
              max={5}
              value={scheduleCount}
              onChange={(event) => setScheduleCount(Number(event.target.value))}
            />
            <Button variant="secondary" onClick={saveScheduler} disabled={Boolean(working) || schedulerRunning}>
              {working === "schedule" ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Save
            </Button>
            {schedulerRunning ? (
              <Button variant="destructive" onClick={stopScheduler} disabled={stoppingScheduler}>
                {stoppingScheduler ? <Loader2 size={16} className="animate-spin" /> : <Square size={15} />}
                {stoppingScheduler ? "Stopping" : "Stop scheduler"}
              </Button>
            ) : (
              <Button onClick={() => runScheduler(true)} disabled={Boolean(working)}>
                {working === "run-now" ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Run now
              </Button>
            )}
            <div className="md:col-span-5 text-xs text-muted-foreground">
              {schedulerRunning
                ? "Scheduled generation is active. Draft review and publishing remain available."
                : `Next run: ${data?.schedule.nextRunAt ? new Date(data.schedule.nextRunAt).toLocaleString() : "Not scheduled"}`}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card elevated className="mb-5">
        <CardHeader>
          <CardTitle>Draft Approval Queue</CardTitle>
          <CardDescription>Drafts stay private until an admin publishes them.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <LoadingRow label="Loading drafts" />
          ) : (data?.drafts || []).length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No drafts waiting for review</div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {(data?.drafts || []).map((draft) => (
                <div key={draft.id} className="rounded-lg border border-border bg-secondary/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold leading-snug">{draft.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{draft.keyword}</p>
                    </div>
                    <Badge variant={draft.status === "published" ? "success" : "warning"}>
                      {draft.status}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{draft.wordCount.toLocaleString()} words</span>
                    <span>{draft.imageCount} images</span>
                    <span>{new Date(draft.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => previewDraft(draft.id)} disabled={Boolean(working)}>
                      {working === `preview-${draft.id}` ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                      Preview
                    </Button>
                    {draft.publicPath && (
                      <Button asChild variant="secondary" size="sm">
                        <Link href={draft.publicPath}>
                          View
                          <ArrowUpRight size={14} />
                        </Link>
                      </Button>
                    )}
                    {draft.status === "draft" && (
                      <Button size="sm" onClick={() => publishDraft(draft.id)} disabled={Boolean(working)}>
                        {working === draft.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        Approve and publish
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {draftDetail && (
        <div ref={previewRef} className="scroll-mt-6">
        <Card elevated className="mb-5">
          <CardHeader className="gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle>{draftDetail.draft.title}</CardTitle>
              <CardDescription>
                {draftDetail.draft.status === "published" ? "Published article" : "Private draft"} ·{" "}
                {draftDetail.metrics.readingTimeMinutes} min read · {draftDetail.metrics.wordCount.toLocaleString()} words · {draftDetail.metrics.readabilityLabel} readability
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <a href={`/api/admin/articles/drafts/${draftDetail.draft.id}/download`}>
                  <Download size={16} />
                  ZIP
                </a>
              </Button>
              <Button onClick={generateAudio} disabled={Boolean(working)}>
                {working === "audio" ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
                Read aloud
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-5">
              <Metric label="Words" value={draftDetail.metrics.wordCount.toLocaleString()} />
              <Metric label="Read time" value={`${draftDetail.metrics.readingTimeMinutes} min`} />
              <Metric label="Readability" value={`${draftDetail.metrics.readabilityScore}/100`} />
              <Metric label="Keyword" value={`${draftDetail.metrics.keywordDensity}%`} />
              <Metric label="Links" value={`${draftDetail.metrics.internalLinkCount} / ${draftDetail.metrics.externalLinkCount}`} />
            </div>

            {draftDetail.audioUrl && (
              <audio controls className="w-full" src={draftDetail.audioUrl} />
            )}

            <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">Article Preview</h3>
                  <span className="text-xs text-muted-foreground">
                    Live tracker: {draftDetail.metrics.wordCount.toLocaleString()} / 4,000 words
                  </span>
                </div>
                <div className="max-h-[760px] overflow-auto rounded-lg border border-border bg-background/70 p-5 amrogen-markdown"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-secondary/35 p-4">
                  <h3 className="mb-3 text-sm font-semibold">Improve or Regenerate</h3>
                  <textarea
                    value={feedback}
                    onChange={(event) => setFeedback(event.target.value)}
                    placeholder="Optional feedback for the agent"
                    className="mb-3 min-h-24 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
                  />
                  <div className="grid gap-2">
                    <Button onClick={regenerateArticle} disabled={Boolean(working)}>
                      {working === "regenerate-article" ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                      Regenerate article
                    </Button>
                    {["Keyword Density", "Readability", "External Links", "Internal Links", "E-E-A-T"].map((metric) => (
                      <Button key={metric} variant="secondary" onClick={() => improveArticle(metric)} disabled={Boolean(working)}>
                        {working === `improve-${metric}` ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                        Improve {metric}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-secondary/35 p-4">
                  <h3 className="mb-3 text-sm font-semibold">Suggest Internal Links</h3>
                  <textarea
                    value={siteMapInput}
                    onChange={(event) => setSiteMapInput(event.target.value)}
                    placeholder="/pricing /features/lead-generation /blog/example"
                    className="mb-3 min-h-20 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
                  />
                  <Button variant="secondary" onClick={suggestLinks} disabled={Boolean(working)} className="w-full">
                    {working === "suggest-links" ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
                    Suggest Internal Links
                  </Button>
                  <div className="mt-3 space-y-2">
                    {suggestions.slice(0, 8).map((suggestion) => (
                      <div key={`${suggestion.anchorText}-${suggestion.url}`} className="rounded-md border border-border bg-background/60 p-2 text-xs">
                        <p className="font-medium">{suggestion.anchorText}</p>
                        <p className="text-primary">{suggestion.url}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold">Generated Images</h3>
              <div className="mb-3 grid gap-3 md:grid-cols-[1fr_auto]">
                <Input value={imageFeedback} onChange={(event) => setImageFeedback(event.target.value)} placeholder="Optional image feedback before regenerating" />
                <Button onClick={generateImagePackage} disabled={Boolean(working)}>
                  {working === "image-package" ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
                  Generate package
                </Button>
              </div>
              {(draftDetail.draft.assets || []).length === 0 ? (
                <div className="rounded-lg border border-border bg-secondary/30 p-5 text-sm text-muted-foreground">
                  No image assets are referenced yet. Generate a package to create a feature image and article-specific visuals.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {(draftDetail.draft.assets || []).map((asset) => (
                  <div key={asset.id} className="rounded-lg border border-border bg-secondary/30 p-3">
                    <img
                      src={`/blog-assets/${asset.fileName}?v=${encodeURIComponent(asset.createdAt || "")}`}
                      alt={asset.alt}
                      loading="lazy"
                      decoding="async"
                      className="aspect-video w-full rounded-md object-cover"
                    />
                    <p className="mt-2 text-xs font-medium">{asset.alt}</p>
                    <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => regenerateImage(asset.id)} disabled={Boolean(working)}>
                      {working === asset.id ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                      Regenerate image
                    </Button>
                  </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        </div>
      )}

      <Card elevated>
        <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Published Inventory</CardTitle>
            <CardDescription>
              {data?.generatedAt ? `Last scanned ${new Date(data.generatedAt).toLocaleTimeString()}` : "Scanning docs/latest"}
            </CardDescription>
          </div>
          <div className="relative w-full lg:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search published articles"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <LoadingRow label="Loading article inventory" />
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No matching articles found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Article</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Keyword</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Words</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Assets</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Updated</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((post) => (
                    <tr key={post.slug} className="transition-colors hover:bg-secondary/30">
                      <td className="max-w-md px-4 py-4">
                        <div className="flex gap-3">
                          <div className="hidden h-16 w-24 shrink-0 overflow-hidden rounded-md border border-border bg-secondary/40 sm:block">
                            {post.imageSrc ? (
                              <img
                                src={post.imageSrc}
                                alt={post.imageAlt || post.title}
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                <ImageIcon size={18} />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium">{post.title}</p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">{post.fileName}</p>
                            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{post.metaDescription}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="default">{post.primaryKeyword || "No keyword"}</Badge>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-muted-foreground">
                        {post.wordCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={post.imageCount ? "secondary" : "warning"} className="gap-1">
                            <ImageIcon size={12} />
                            {post.imageCount}
                          </Badge>
                          <Badge variant={post.faqCount ? "secondary" : "outline"}>{post.faqCount} FAQ</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {post.updatedAt ? new Date(post.updatedAt).toLocaleString() : "Unknown"}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" size="sm" onClick={() => previewDraft(post.adminId)} disabled={Boolean(working)}>
                            {working === `preview-${post.adminId}` && <Loader2 size={14} className="animate-spin" />}
                            Manage
                          </Button>
                          <Button asChild variant="ghost" size="sm">
                            <Link href={post.publicPath}>
                              View
                              <ArrowUpRight size={14} />
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-20 text-sm text-muted-foreground gap-2">
      <Loader2 size={18} className="animate-spin" />
      {label}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card elevated className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight">{value.toLocaleString()}</p>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/35 px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
