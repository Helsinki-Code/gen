"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  AlertTriangle,
  Bot,
  CalendarClock,
  ExternalLink,
  Lightbulb,
  Loader2,
  Megaphone,
  Mic2,
  Play,
  Radio,
  RefreshCw,
  Send,
  Sparkles,
  Wand2,
} from "lucide-react";
import AdminGuard from "@/components/AdminGuard";
import { api, apiUrl } from "@/lib/api";
import { useAuthToken } from "@/lib/auth/use-auth-token";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface PodcastEpisode {
  id: string;
  title: string;
  topic: string;
  source_type: string;
  source_url: string | null;
  audience: string;
  tone: string;
  duration_minutes: number;
  status: "script_ready" | "audio_ready" | "published" | "failed";
  script: string;
  summary: string;
  show_notes: string;
  audio_url: string | null;
  audio_mime_type: string | null;
  duration_seconds: number | null;
  cover_image_url: string | null;
  cover_image_mime_type: string | null;
  cover_image_alt: string | null;
  cover_image_prompt: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_content: string | null;
  seo_keywords: string[];
  seo_faq: Array<{ question: string; answer: string }>;
  publish_url: string | null;
  error_message: string | null;
  created_at: string;
  published_at: string | null;
}

interface PodcastIdea {
  id: string;
  title: string;
  topic: string;
  angle: string;
  why_now: string;
  audience: string;
  tone: string;
  duration_minutes: number;
  source_type: string;
  source_url: string | null;
  notes: string;
  seo_keywords: string[];
}

interface PodcastIdeasResponse {
  ideas: PodcastIdea[];
  research_summary: string;
}

const SOURCE_TYPES = [
  { value: "product_update", label: "Product Update" },
  { value: "seo_article", label: "SEO Article" },
  { value: "release_note", label: "Release Note" },
  { value: "customer_story", label: "Customer Story" },
  { value: "thought_leadership", label: "Thought Leadership" },
];

const STATUS_VARIANT: Record<PodcastEpisode["status"], "default" | "secondary" | "success" | "warning" | "destructive"> = {
  script_ready: "warning",
  audio_ready: "default",
  published: "success",
  failed: "destructive",
};

const STATUS_COPY: Record<PodcastEpisode["status"], string> = {
  script_ready: "Script is ready. Generate audio before publishing.",
  audio_ready: "Audio is ready for secure playback and publishing.",
  published: "Episode is live on the public podcast archive.",
  failed: "Audio generation failed. Review the error and retry after configuration is fixed.",
};

function normalizeSourceReference(rawValue: string): string {
  let value = rawValue.trim();
  if (!value || value.startsWith("/blog/")) return value;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    new URL(value);
  } catch {
    throw new Error("Source must be a valid /blog/article-slug path or an http(s) URL.");
  }
  return value;
}

function dedupeEpisodes(list: PodcastEpisode[]): PodcastEpisode[] {
  const seen = new Set<string>();
  return list.filter((episode) => {
    if (seen.has(episode.id)) return false;
    seen.add(episode.id);
    return true;
  });
}

function prependUniqueEpisodes(incoming: PodcastEpisode[], existing: PodcastEpisode[]): PodcastEpisode[] {
  const incomingIds = new Set(incoming.map((episode) => episode.id));
  return dedupeEpisodes([...incoming, ...existing.filter((episode) => !incomingIds.has(episode.id))]);
}

export default function PodcastStudioPage() {
  return (
    <AdminGuard>
      <PodcastStudioContent />
    </AdminGuard>
  );
}

function PodcastStudioContent() {
  const getToken = useAuthToken();
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [audioSrc, setAudioSrc] = useState("");
  const [error, setError] = useState("");
  const [ideaGuidance, setIdeaGuidance] = useState("");
  const [ideaCount, setIdeaCount] = useState(6);
  const [ideaLoading, setIdeaLoading] = useState(false);
  const [ideas, setIdeas] = useState<PodcastIdea[]>([]);
  const [selectedIdeaIds, setSelectedIdeaIds] = useState<string[]>([]);
  const [researchSummary, setResearchSummary] = useState("");
  const [batchCreating, setBatchCreating] = useState(false);
  const [form, setForm] = useState({
    title: "",
    topic: "What changed in AmroGen this week",
    source_type: "product_update",
    source_url: "",
    audience: "B2B founders and GTM teams",
    tone: "sharp, useful, energetic",
    duration_minutes: 6,
    notes:
      "Cover AmroGen's AI SDR workflow, website-to-lead generation, quality review loop, personalized cold email, multi-channel outreach, and why teams should judge tools by booked meetings rather than activity.",
    generate_audio: true,
  });

  async function loadEpisodes() {
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) return;
      const data = (await api.getPodcasts(token)) as PodcastEpisode[];
      const uniqueEpisodes = dedupeEpisodes(data);
      setEpisodes(uniqueEpisodes);
      setSelectedId((current) => current || uniqueEpisodes[0]?.id || "");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load podcasts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEpisodes();
  }, [getToken]);

  const selected = useMemo(
    () => episodes.find((episode) => episode.id === selectedId) || episodes[0],
    [episodes, selectedId]
  );

  useEffect(() => {
    let objectUrl = "";
    setAudioSrc("");
    if (!selected?.audio_url) return;

    (async () => {
      const token = await getToken();
      if (!token) return;
      const response = await fetch(apiUrl(selected.audio_url!), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      setAudioSrc(objectUrl);
    })();

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selected?.audio_url, getToken]);

  async function handleCreate() {
    const topic = form.topic.trim().slice(0, 240);
    if (topic.length < 3) {
      setError("Topic must contain at least 3 characters.");
      return;
    }

    let sourceUrl = "";
    try {
      sourceUrl = normalizeSourceReference(form.source_url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid source page");
      return;
    }

    const durationMinutes = Math.min(18, Math.max(2, Math.round(Number(form.duration_minutes) || 6)));
    setCreating(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) return;
      const created = (await api.createPodcast(token, {
        title: form.title.trim().slice(0, 180) || undefined,
        topic,
        source_type: form.source_type,
        source_url: sourceUrl || undefined,
        audience: form.audience.trim().slice(0, 300),
        tone: form.tone.trim().slice(0, 300),
        duration_minutes: durationMinutes,
        notes: form.notes.trim().slice(0, 8000),
        generate_audio: form.generate_audio,
      })) as PodcastEpisode;
      setEpisodes((prev) => prependUniqueEpisodes([created], prev));
      setSelectedId(created.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to create podcast");
    } finally {
      setCreating(false);
    }
  }

  async function handleGenerateAudio(id: string) {
    setWorkingId(id);
    setError("");
    try {
      const token = await getToken();
      if (!token) return;
      const updated = (await api.generatePodcastAudio(token, id)) as PodcastEpisode;
      replaceEpisode(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to generate audio");
    } finally {
      setWorkingId("");
    }
  }

  async function handlePublish(id: string) {
    setWorkingId(id);
    setError("");
    try {
      const token = await getToken();
      if (!token) return;
      const updated = (await api.publishPodcast(token, id)) as PodcastEpisode;
      replaceEpisode(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to publish podcast");
    } finally {
      setWorkingId("");
    }
  }

  async function handleRegenerateSeoPackage(id: string) {
    setWorkingId(`seo:${id}`);
    setError("");
    try {
      const token = await getToken();
      if (!token) return;
      const updated = (await api.regeneratePodcastSeoPackage(token, id)) as PodcastEpisode;
      replaceEpisode(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to regenerate podcast SEO and cover");
    } finally {
      setWorkingId("");
    }
  }

  function replaceEpisode(updated: PodcastEpisode) {
    setEpisodes((prev) => prev.map((episode) => (episode.id === updated.id ? updated : episode)));
    setSelectedId(updated.id);
  }

  async function handleGenerateIdeas(regenerate = false) {
    setIdeaLoading(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) return;
      const result = (await api.generatePodcastIdeas(token, {
        guidance: ideaGuidance,
        audience: form.audience,
        count: ideaCount,
        exclude_topics: regenerate ? ideas.map((idea) => idea.topic) : [],
      })) as PodcastIdeasResponse;
      setIdeas(result.ideas);
      setResearchSummary(result.research_summary);
      setSelectedIdeaIds(result.ideas[0] ? [result.ideas[0].id] : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to research podcast ideas");
    } finally {
      setIdeaLoading(false);
    }
  }

  function toggleIdea(id: string) {
    setSelectedIdeaIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function applyIdeaToForm(idea: PodcastIdea) {
    setForm((current) => ({
      ...current,
      title: idea.title.slice(0, 180),
      topic: idea.topic.slice(0, 240),
      source_type: idea.source_type,
      source_url: idea.source_url || "",
      audience: idea.audience.slice(0, 300),
      tone: idea.tone.slice(0, 300),
      duration_minutes: idea.duration_minutes,
      notes: idea.notes.slice(0, 8000),
    }));
  }

  async function handleCreateSelectedIdeas() {
    const selectedIdeas = ideas.filter((idea) => selectedIdeaIds.includes(idea.id));
    if (!selectedIdeas.length) return;
    setBatchCreating(true);
    setError("");
    const created: PodcastEpisode[] = [];
    try {
      const token = await getToken();
      if (!token) return;
      for (const idea of selectedIdeas) {
        const episode = (await api.createPodcast(token, {
          title: idea.title,
          topic: idea.topic,
          source_type: idea.source_type,
          source_url: idea.source_url || undefined,
          audience: idea.audience,
          tone: idea.tone,
          duration_minutes: idea.duration_minutes,
          notes: [
            idea.notes,
            `Editorial angle: ${idea.angle}`,
            `Why now: ${idea.why_now}`,
            idea.seo_keywords.length ? `SEO themes: ${idea.seo_keywords.join(", ")}` : "",
          ].filter(Boolean).join("\n\n"),
          generate_audio: form.generate_audio,
        })) as PodcastEpisode;
        created.push(episode);
      }
      const newestFirst = [...created].reverse();
      setEpisodes((current) => prependUniqueEpisodes(newestFirst, current));
      if (newestFirst[0]) setSelectedId(newestFirst[0].id);
      setSelectedIdeaIds([]);
    } catch (err: unknown) {
      if (created.length) {
        const newestFirst = [...created].reverse();
        setEpisodes((current) => prependUniqueEpisodes(newestFirst, current));
        if (newestFirst[0]) setSelectedId(newestFirst[0].id);
      }
      setError(err instanceof Error ? err.message : "Unable to create selected podcasts");
    } finally {
      setBatchCreating(false);
    }
  }

  const selectedCanPublish = Boolean(selected?.audio_url && selected.status !== "published");

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-5 mb-7">
        <div>
          <div className="inline-flex items-center gap-2 text-primary text-sm font-medium mb-3">
            <Radio size={16} />
            AmroGen media engine
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Podcast Studio</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Turn AmroGen updates, articles, launch notes, and GTM insights into reviewable two-host audio episodes.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 w-full xl:w-auto">
          <Metric label="Drafts" value={episodes.filter((e) => e.status === "script_ready").length} />
          <Metric label="Audio" value={episodes.filter((e) => e.status === "audio_ready").length} />
          <Metric label="Live" value={episodes.filter((e) => e.status === "published").length} />
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid xl:grid-cols-[420px_1fr] gap-5">
        <div className="space-y-5">
          <Card elevated>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles size={18} className="text-primary" />
                Trend & Content Idea Lab
              </CardTitle>
              <CardDescription>
                Research current market conversations and AmroGen content, then select one or several episodes to produce.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Optional editorial direction">
                <textarea
                  value={ideaGuidance}
                  onChange={(event) => setIdeaGuidance(event.target.value)}
                  placeholder="Example: prioritize deliverability changes, founder-led outbound, and practical operator takeaways."
                  className="min-h-20 w-full resize-y rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </Field>
              <div className="grid grid-cols-[100px_1fr] gap-2">
                <Input
                  type="number"
                  min={3}
                  max={10}
                  value={ideaCount}
                  onChange={(event) => setIdeaCount(Math.min(10, Math.max(3, Number(event.target.value) || 6)))}
                  aria-label="Number of podcast ideas"
                />
                <Button onClick={() => handleGenerateIdeas(false)} disabled={ideaLoading}>
                  {ideaLoading ? <Loader2 size={16} className="animate-spin" /> : <Lightbulb size={16} />}
                  Generate ideas
                </Button>
              </div>

              {researchSummary && (
                <div className="rounded-lg border border-primary/20 bg-primary/10 p-3 text-xs leading-5 text-muted-foreground">
                  <span className="font-semibold text-foreground">Research signal: </span>
                  {researchSummary}
                </div>
              )}

              {ideas.length > 0 && (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium">
                      {selectedIdeaIds.length} of {ideas.length} selected
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedIdeaIds(ideas.map((idea) => idea.id))}
                        className="text-xs text-primary hover:underline"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedIdeaIds([])}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="max-h-[540px] space-y-2 overflow-auto pr-1">
                    {ideas.map((idea) => {
                      const checked = selectedIdeaIds.includes(idea.id);
                      return (
                        <div
                          key={idea.id}
                          className={cn(
                            "rounded-lg border p-3 transition-colors",
                            checked ? "border-primary/45 bg-primary/10" : "border-border bg-secondary/30"
                          )}
                        >
                          <label className="flex cursor-pointer items-start gap-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleIdea(idea.id)}
                              className="mt-1 h-4 w-4 shrink-0 accent-primary"
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold leading-snug">{idea.title}</span>
                              <span className="mt-1 block text-xs leading-5 text-muted-foreground">{idea.angle}</span>
                            </span>
                          </label>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {idea.seo_keywords.slice(0, 3).map((keyword, index) => (
                              <Badge key={`${keyword}-${index}`} variant="secondary" className="text-[10px]">{keyword}</Badge>
                            ))}
                          </div>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">
                            <span className="font-medium text-foreground">Why now:</span> {idea.why_now}
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="mt-2 w-full"
                            onClick={() => applyIdeaToForm(idea)}
                          >
                            Use in episode editor
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid gap-2">
                    <Button onClick={handleCreateSelectedIdeas} disabled={batchCreating || selectedIdeaIds.length === 0}>
                      {batchCreating ? <Loader2 size={16} className="animate-spin" /> : <Mic2 size={16} />}
                      Generate {selectedIdeaIds.length || ""} selected podcast{selectedIdeaIds.length === 1 ? "" : "s"}
                    </Button>
                    <Button variant="secondary" onClick={() => handleGenerateIdeas(true)} disabled={ideaLoading || batchCreating}>
                      {ideaLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                      Regenerate different ideas
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

        <Card elevated className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic2 size={18} className="text-primary" />
              Create Episode
            </CardTitle>
            <CardDescription>Build the script, generate audio, then publish when ready.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Episode title" optional>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="AmroGen Growth Brief: June update"
                maxLength={180}
              />
            </Field>

            <Field label="Topic">
              <Input
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                placeholder="What changed in AmroGen this week"
                minLength={3}
                maxLength={240}
              />
            </Field>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Source">
                <select
                  value={form.source_type}
                  onChange={(e) => setForm({ ...form, source_type: e.target.value })}
                  className="h-10 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {SOURCE_TYPES.map((source) => (
                    <option key={source.value} value={source.value}>
                      {source.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Length">
                <Input
                  type="number"
                  min={2}
                  max={18}
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                />
              </Field>
            </div>

            <Field label="Source article or URL" optional>
              <Input
                type="text"
                value={form.source_url}
                onChange={(e) => setForm({ ...form, source_url: e.target.value })}
                placeholder="/blog/best-ai-sdr-tools-2026 or https://example.com/article"
              />
            </Field>

            <Field label="Audience">
              <Input
                value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value })}
                maxLength={300}
              />
            </Field>

            <Field label="Tone">
              <Input
                value={form.tone}
                onChange={(e) => setForm({ ...form, tone: e.target.value })}
                maxLength={300}
              />
            </Field>

            <Field label="Director notes">
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                maxLength={8000}
                className="min-h-32 w-full resize-y rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </Field>

            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-sm">
              <span className="flex items-center gap-2">
                <Sparkles size={15} className="text-primary" />
                Generate Gemini audio now
              </span>
              <input
                type="checkbox"
                checked={form.generate_audio}
                onChange={(e) => setForm({ ...form, generate_audio: e.target.checked })}
                className="h-4 w-4 accent-primary"
              />
            </label>

            <Button onClick={handleCreate} disabled={creating || !form.topic.trim()} className="w-full" size="lg">
              {creating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Creating episode
                </>
              ) : (
                <>
                  <Wand2 size={18} />
                  Create Podcast
                </>
              )}
            </Button>
          </CardContent>
        </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle>Episode Queue</CardTitle>
                <CardDescription>Monitor scripts, audio readiness, and publishing state.</CardDescription>
              </div>
              <Button variant="secondary" size="sm" onClick={loadEpisodes}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {loading ? "Refreshing" : "Refresh"}
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-16 text-sm text-muted-foreground gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Loading studio
                </div>
              ) : episodes.length === 0 ? (
                <div className="py-16 text-center">
                  <Bot size={30} className="text-primary mx-auto mb-3" />
                  <p className="font-medium">No episodes yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Create the first AmroGen Growth Brief from the panel.</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {episodes.map((episode) => (
                    <button
                      key={episode.id}
                      onClick={() => setSelectedId(episode.id)}
                      className={cn(
                        "text-left rounded-lg border p-4 transition-all duration-200",
                        selected?.id === episode.id
                          ? "border-primary/50 bg-primary/10 glow-border"
                          : "border-border bg-secondary/30 hover:bg-secondary/60"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold text-sm leading-snug">{episode.title}</h3>
                        <Badge variant={STATUS_VARIANT[episode.status]} className="shrink-0">
                          {episode.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{episode.summary}</p>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-3">
                        <span className="flex items-center gap-1">
                          <CalendarClock size={12} />
                          {new Date(episode.created_at).toLocaleDateString()}
                        </span>
                        <span>{episode.duration_minutes} min target</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {selected && (
            <Card elevated>
              <CardHeader>
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={STATUS_VARIANT[selected.status]}>{selected.status.replace(/_/g, " ")}</Badge>
                      {selected.duration_seconds && (
                        <Badge variant="secondary">{Math.round(selected.duration_seconds / 60)} min audio</Badge>
                      )}
                    </div>
                    <CardTitle>{selected.title}</CardTitle>
                    <CardDescription className="mt-2">{selected.summary}</CardDescription>
                    <p className="mt-3 text-xs text-muted-foreground">{STATUS_COPY[selected.status]}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleGenerateAudio(selected.id)}
                      disabled={workingId === selected.id}
                    >
                      {workingId === selected.id ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                      {selected.audio_url ? "Regenerate Audio" : selected.status === "failed" ? "Retry Audio" : "Generate Audio"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handlePublish(selected.id)}
                      disabled={!selectedCanPublish || workingId === selected.id}
                    >
                      {selected.status === "published" ? <BadgeCheck size={14} /> : <Send size={14} />}
                      {selected.status === "published" ? "Published" : "Publish"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRegenerateSeoPackage(selected.id)}
                      disabled={workingId === `seo:${selected.id}`}
                    >
                      {workingId === `seo:${selected.id}` ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      SEO + Cover
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 md:grid-cols-3">
                  <StepCard
                    label="1"
                    title="Plan"
                    body="Script and show notes are ready for review."
                    active={["script_ready", "audio_ready", "published"].includes(selected.status)}
                  />
                  <StepCard
                    label="2"
                    title="Generate Audio"
                    body="Gemini TTS creates the listening asset."
                    active={["audio_ready", "published"].includes(selected.status)}
                  />
                  <StepCard
                    label="3"
                    title="Publish"
                    body="Live episodes appear on /podcasts and the homepage."
                    active={selected.status === "published"}
                  />
                </div>

                {selected.status === "published" && selected.publish_url && (
                  <a
                    href={selected.publish_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-medium text-primary"
                  >
                    View public podcast page
                    <ExternalLink size={15} />
                  </a>
                )}

                {(selected.seo_title || selected.cover_image_prompt) && (
                  <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
                    {selected.cover_image_url && selected.status === "published" && (
                      <img
                        src={apiUrl(`/podcasts/public/${selected.id}/cover`)}
                        alt={selected.cover_image_alt || selected.title}
                        className="aspect-video w-full rounded-lg border border-border object-cover"
                      />
                    )}
                    <div className="rounded-lg border border-border bg-secondary/30 p-4 text-sm">
                      <div className="mb-2 flex items-center gap-2 font-medium">
                        <Sparkles size={15} className="text-primary" />
                        SEO page package
                      </div>
                      <p className="text-muted-foreground">{selected.seo_title || "SEO title pending"}</p>
                      {selected.seo_description && (
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">{selected.seo_description}</p>
                      )}
                      {selected.seo_keywords?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {selected.seo_keywords.slice(0, 6).map((keyword, index) => (
                            <Badge key={`${keyword}-${index}`} variant="secondary" className="text-[10px]">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selected.error_message && (
                  <div className="flex gap-3 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Audio generation failed</p>
                      <p className="mt-1 text-destructive/90">{selected.error_message}</p>
                    </div>
                  </div>
                )}

                {selected.audio_url ? (
                  <div className="rounded-lg border border-border bg-secondary/30 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium mb-3">
                      <Megaphone size={16} className="text-primary" />
                      Episode audio
                    </div>
                    {audioSrc ? (
                      <audio controls className="w-full" src={audioSrc} />
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 size={14} className="animate-spin" />
                        Preparing secure audio playback
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-100">
                    <div className="flex items-center gap-2 font-medium">
                      <AlertTriangle size={16} />
                      Audio not ready
                    </div>
                    <p className="mt-2 text-amber-700/80 dark:text-amber-100/80">
                      Generate audio before publishing. If generation fails, confirm `GEMINI_API_KEY` is configured for the backend.
                    </p>
                  </div>
                )}

                <div className="grid lg:grid-cols-[1fr_280px] gap-4">
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Script</h3>
                    <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background/70 p-4 text-xs leading-relaxed text-muted-foreground">
                      {selected.script}
                    </pre>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Show Notes</h3>
                    <div className="rounded-lg border border-border bg-secondary/30 p-4 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                      {selected.show_notes}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
    </div>
  );
}

function StepCard({
  label,
  title,
  body,
  active,
}: {
  label: string;
  title: string;
  body: string;
  active: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        active ? "border-primary/35 bg-primary/10" : "border-border bg-secondary/30"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-bold",
            active ? "border-primary/30 bg-primary/15 text-primary" : "border-border text-muted-foreground"
          )}
        >
          {label}
        </div>
        <div className="text-sm font-semibold">{title}</div>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">{body}</p>
    </div>
  );
}

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <Label className="mb-2 flex items-center gap-2">
        {label}
        {optional && <span className="text-xs font-normal text-muted-foreground">optional</span>}
      </Label>
      {children}
    </div>
  );
}
