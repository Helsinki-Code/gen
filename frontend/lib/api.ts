import { getApiUrl, resolveApiUrlAsync } from "@/lib/runtime-api-url";

async function resolveApiUrl(): Promise<string> {
  try {
    return await resolveApiUrlAsync();
  } catch {
    const url = getApiUrl();
    if (url) return url;
    if (process.env.NODE_ENV === "development") return "http://localhost:8000";
    throw new Error("API URL is not configured. Set AMROGEN_BACKEND_URL on the frontend Cloud Run service.");
  }
}

type ApiErrorItem = {
  loc?: Array<string | number>;
  msg?: string;
  message?: string;
};

function apiErrorMessage(payload: unknown, status: number): string {
  if (!payload || typeof payload !== "object") return `HTTP ${status}`;

  const body = payload as { detail?: unknown; message?: unknown };
  const detail = body.detail;
  if (typeof detail === "string" && detail.trim()) return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item: unknown) => {
        if (typeof item === "string") return item;
        if (!item || typeof item !== "object") return "";
        const error = item as ApiErrorItem;
        const field = error.loc
          ?.filter((part) => part !== "body")
          .map(String)
          .join(".");
        const message = error.msg || error.message || "Invalid value";
        return field ? `${field}: ${message}` : message;
      })
      .filter(Boolean);
    if (messages.length) return messages.join("; ");
  }

  if (detail && typeof detail === "object") {
    const error = detail as ApiErrorItem;
    if (error.msg || error.message) return error.msg || error.message || `HTTP ${status}`;
    try {
      return JSON.stringify(detail);
    } catch {
      return `HTTP ${status}`;
    }
  }

  if (typeof body.message === "string" && body.message.trim()) return body.message;
  return `HTTP ${status}`;
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const base = await resolveApiUrl();
  const res = await fetch(`${base}${path}`, { ...fetchOptions, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(apiErrorMessage(err, res.status));
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Campaigns
  createCampaign: (token: string, body: { target_url: string; leads_requested: number; batch_size?: number }) =>
    request("/campaigns", { method: "POST", body: JSON.stringify(body), token }),

  getCampaigns: (token: string) =>
    request("/campaigns", { token }),

  getCampaign: (token: string, id: string) =>
    request(`/campaigns/${id}`, { token }),

  getLeads: (token: string, id: string) =>
    request(`/campaigns/${id}/leads`, { token }),

  getSequences: (token: string, id: string) =>
    request(`/campaigns/${id}/sequences`, { token }),

  confirmLeads: (token: string, id: string, removedLeadIds?: string[]) =>
    request(`/campaigns/${id}/confirm-leads`, {
      method: "POST",
      body: JSON.stringify(removedLeadIds ?? []),
      token,
    }),

  approveAll: (token: string, id: string) =>
    request(`/campaigns/${id}/approve-all`, { method: "POST", token }),

  getReplies: (token: string, id: string) =>
    request(`/campaigns/${id}/replies`, { token }),

  logReply: (token: string, id: string, body: {
    sequence_id: string; lead_name: string; company?: string;
    channel: "email" | "sms"; from_email?: string; subject?: string;
    body_full: string; intent: string; sentiment_score?: number; next_action?: string;
  }) =>
    request(`/campaigns/${id}/replies`, { method: "POST", body: JSON.stringify(body), token }),

  triggerSend: (token: string, id: string, senderName: string) =>
    request(`/campaigns/${id}/send?sender_name=${encodeURIComponent(senderName)}`, { method: "POST", token }),

  // API Keys
  getApiKeys: (token: string) =>
    request("/api-keys", { token }),

  createApiKey: (token: string, name: string) =>
    request("/api-keys", { method: "POST", body: JSON.stringify({ name }), token }),

  revokeApiKey: (token: string, id: string) =>
    request(`/api-keys/${id}`, { method: "DELETE", token }),

  // Credits
  getBalance: (token: string) =>
    request("/credits/balance", { token }),

  purchaseCredits: (token: string, plan: string) =>
    request("/credits/purchase", { method: "POST", body: JSON.stringify({ plan }), token }),

  confirmCreditsSession: (token: string, sessionId: string) =>
    request("/credits/confirm-session", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId }),
      token,
    }),

  // Gmail
  getGmailAuthUrl: (token: string) =>
    request<{ auth_url: string }>("/gmail/auth-url", { token }),

  getGmailStatus: (token: string) =>
    request<{ connected: boolean; gmail_email: string | null }>("/gmail/status", { token }),

  disconnectGmail: (token: string) =>
    request("/gmail/disconnect", { method: "DELETE", token }),

  // Resend
  getResendStatus: (token: string) =>
    request<{ connected: boolean; from_email: string | null; from_name: string | null }>(
      "/resend/status",
      { token }
    ),

  connectResend: (
    token: string,
    body: { api_key: string; from_email: string; from_name: string }
  ) =>
    request("/resend/connect", { method: "POST", body: JSON.stringify(body), token }),

  disconnectResend: (token: string) =>
    request("/resend/disconnect", { method: "DELETE", token }),

  // Twilio
  getTwilioStatus: (token: string) =>
    request<{ connected: boolean; from_number: string | null }>("/twilio/status", { token }),

  connectTwilio: (
    token: string,
    body: { account_sid: string; auth_token: string; from_number: string }
  ) =>
    request("/twilio/connect", { method: "POST", body: JSON.stringify(body), token }),

  disconnectTwilio: (token: string) =>
    request("/twilio/disconnect", { method: "DELETE", token }),

  // Podcasts
  getPodcasts: (token: string) =>
    request("/podcasts", { token }),

  createPodcast: (
    token: string,
    body: {
      title?: string;
      topic: string;
      source_type: string;
      source_url?: string;
      notes?: string;
      audience?: string;
      tone?: string;
      duration_minutes?: number;
      generate_audio?: boolean;
    }
  ) =>
    request("/podcasts", { method: "POST", body: JSON.stringify(body), token }),

  generatePodcastAudio: (token: string, id: string) =>
    request(`/podcasts/${id}/generate-audio`, { method: "POST", token }),

  publishPodcast: (token: string, id: string) =>
    request(`/podcasts/${id}/publish`, { method: "POST", token }),

  regeneratePodcastSeoPackage: (token: string, id: string) =>
    request(`/podcasts/${id}/seo-package`, { method: "POST", token }),

  askPodcastAssistant: (
    token: string,
    body: {
      prompt: string;
      title?: string;
      topic?: string;
      source_type?: string;
      source_url?: string;
      notes?: string;
      audience?: string;
      tone?: string;
      duration_minutes?: number;
    }
  ) =>
    request("/podcasts/assistant", { method: "POST", body: JSON.stringify(body), token }),

  generatePodcastIdeas: (
    token: string,
    body: {
      guidance?: string;
      audience?: string;
      count?: number;
      exclude_topics?: string[];
    }
  ) =>
    request("/podcasts/ideas", { method: "POST", body: JSON.stringify(body), token }),

  // Campaign stats
  getCampaignStats: (token: string, id: string) =>
    request<{
      total_steps: number; sent: number; scheduled: number; failed: number; skipped: number;
      sequences_active: number; sequences_paused: number; sequences_stopped: number;
      replies_total: number; replies_hot: number; next_send_at: string | null;
    }>(`/campaigns/${id}/stats`, { token }),

  updateSequence: (token: string, campaignId: string, seqId: string, body: { status: string }) =>
    request(`/campaigns/${campaignId}/sequences/${seqId}`, {
      method: "PUT",
      body: JSON.stringify(body),
      token,
    }),

  // Contacts
  getContactStats: (token: string) =>
    request<{ total: number; active: number; replied: number; hot: number; converted: number }>(
      "/contacts/stats",
      { token }
    ),

  getContacts: (token: string, params?: {
    campaign_id?: string; status?: string; intent?: string;
    search?: string; page?: number; per_page?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.campaign_id) q.set("campaign_id", params.campaign_id);
    if (params?.status) q.set("status", params.status);
    if (params?.intent) q.set("intent", params.intent);
    if (params?.search) q.set("search", params.search);
    if (params?.page) q.set("page", String(params.page));
    if (params?.per_page) q.set("per_page", String(params.per_page));
    return request<unknown[]>(`/contacts${q.toString() ? `?${q}` : ""}`, { token });
  },

  // Inbox
  getInboxCount: (token: string) =>
    request<{ total: number; hot: number; approvals: number }>("/inbox/count", { token }),

  // Schedule settings
  getScheduleSettings: (token: string) =>
    request<{
      enabled: boolean; mode: string; send_time: string;
      days: string[]; timezone: string;
    }>("/settings/schedule", { token }),

  updateScheduleSettings: (token: string, config: {
    enabled: boolean; mode: string; send_time: string;
    days: string[]; timezone: string;
  }) =>
    request("/settings/schedule", { token, method: "PUT", body: JSON.stringify(config) }),

  getInbox: (token: string, params?: {
    campaign_id?: string; intent?: string; page?: number; per_page?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.campaign_id) q.set("campaign_id", params.campaign_id);
    if (params?.intent) q.set("intent", params.intent);
    if (params?.page) q.set("page", String(params.page));
    if (params?.per_page) q.set("per_page", String(params.per_page));
    return request<unknown[]>(`/inbox${q.toString() ? `?${q}` : ""}`, { token });
  },

  // Discoveries (account discovery)
  getDiscoveries: (token: string, page = 1, perPage = 20) =>
    request(`/discoveries?page=${page}&per_page=${perPage}`, { token }),

  createDiscovery: (
    token: string,
    body: {
      name: string;
      seller_description: string;
      icp_description: string;
      industries?: string[];
      geographies?: string[];
      employee_min?: number | null;
      employee_max?: number | null;
      requested_accounts?: 25 | 50 | 100 | 250 | 500 | 1000;
      signals?: string[];
      competitors?: string[];
      excluded_industries?: string[];
      excluded_domains?: string[];
      excluded_keywords?: string[];
    }
  ) => request("/discoveries", { method: "POST", body: JSON.stringify(body), token }),

  getDiscovery: (token: string, id: string) =>
    request(`/discoveries/${id}`, { token }),

  cancelDiscovery: (token: string, id: string) =>
    request(`/discoveries/${id}/cancel`, { method: "POST", token }),

  getDiscoveryAccounts: (
    token: string,
    id: string,
    params?: { page?: number; per_page?: number; min_score?: number; status?: string }
  ) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.per_page) q.set("per_page", String(params.per_page));
    if (params?.min_score != null) q.set("min_score", String(params.min_score));
    if (params?.status) q.set("status", params.status);
    const qs = q.toString();
    return request(`/discoveries/${id}/accounts${qs ? `?${qs}` : ""}`, { token });
  },

  updateDiscoveryAccount: (
    token: string,
    runId: string,
    accountId: string,
    status: "candidate" | "selected" | "rejected"
  ) =>
    request(`/discoveries/${runId}/accounts/${accountId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
      token,
    }),

  bulkSelectDiscoveryAccounts: (
    token: string,
    runId: string,
    body: {
      account_ids: string[];
      status?: "selected" | "rejected" | "candidate";
    }
  ) =>
    request(`/discoveries/${runId}/accounts/bulk-select`, {
      method: "POST",
      body: JSON.stringify(body),
      token,
    }),

  bulkLaunchDiscovery: (
    token: string,
    runId: string,
    body: {
      account_ids: string[];
      leads_per_account?: number;
      batch_size?: number;
      confirm_large_launch?: boolean;
    }
  ) =>
    request(`/discoveries/${runId}/launch-campaigns`, {
      method: "POST",
      body: JSON.stringify(body),
      token,
    }),

  // Admin
  getAdminOverview: (token: string) =>
    request("/admin/overview", { token }),

  getAdminUsers: (token: string, query = "") =>
    request(`/admin/users${query ? `?q=${encodeURIComponent(query)}` : ""}`, { token }),

  getAdminRevenue: (token: string) =>
    request("/admin/revenue", { token }),
};

export function apiUrl(path: string) {
  const base = getApiUrl();
  if (!base) {
    throw new Error("API URL is not configured. Set AMROGEN_BACKEND_URL on the frontend Cloud Run service.");
  }
  return `${base}${path}`;
}

export function streamCampaignProgress(
  token: string,
  campaignId: string,
  onEvent: (event: Record<string, unknown>) => void,
  onDone: () => void
): () => void {
  let closed = false;
  let es: EventSource | null = null;

  void (async () => {
    try {
      const base = await resolveApiUrl();
      if (closed) return;
      const url = `${base}/campaigns/${campaignId}/stream?token=${encodeURIComponent(token)}`;
      es = new EventSource(url);
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as Record<string, unknown>;
          onEvent(data);
          if (["review", "complete", "failed"].includes(String(data.status))) {
            es?.close();
            onDone();
          }
        } catch {
          /* ignore malformed SSE */
        }
      };
      es.onerror = () => {
        es?.close();
        onDone();
      };
    } catch {
      onDone();
    }
  })();

  return () => {
    closed = true;
    es?.close();
  };
}
