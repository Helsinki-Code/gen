declare global {
  interface Window {
    __AMROGEN_API_URL__?: string;
    __AMROGEN_API_URL_PROMISE__?: Promise<string>;
  }
}

const DEV_FALLBACK = "http://localhost:8000";

function normalize(url: string): string {
  return url.replace(/\/$/, "");
}

async function loadRuntimeApiUrl(): Promise<string> {
  if (typeof window === "undefined") return "";
  if (window.__AMROGEN_API_URL__?.trim()) {
    return normalize(window.__AMROGEN_API_URL__);
  }
  if (!window.__AMROGEN_API_URL_PROMISE__) {
    window.__AMROGEN_API_URL_PROMISE__ = fetch("/api/runtime-config", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return "";
        const data = (await res.json()) as { apiUrl?: string };
        const url = data.apiUrl?.trim() || "";
        if (url) window.__AMROGEN_API_URL__ = url;
        return url ? normalize(url) : "";
      })
      .catch(() => "");
  }
  return window.__AMROGEN_API_URL_PROMISE__;
}

/** Sync API base URL for browser calls (runtime inject, build-time, or localhost). */
export function getApiUrl(): string {
  if (typeof window !== "undefined") {
    const injected = window.__AMROGEN_API_URL__?.trim();
    if (injected) return normalize(injected);
    // Kick off async hydrate for subsequent calls (first call may still use build-time).
    void loadRuntimeApiUrl();
  }

  const built = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (built) return normalize(built);

  if (process.env.NODE_ENV === "development") return DEV_FALLBACK;
  return "";
}

/** Prefer this in async client loaders so a missing layout inject can self-heal. */
export async function resolveApiUrlAsync(): Promise<string> {
  if (typeof window !== "undefined") {
    const runtime = await loadRuntimeApiUrl();
    if (runtime) return runtime;
  }
  const sync = getApiUrl();
  if (sync) return sync;
  if (process.env.NODE_ENV === "development") return DEV_FALLBACK;
  throw new Error(
    "API URL is not configured. Set AMROGEN_BACKEND_URL on the frontend Cloud Run service."
  );
}
