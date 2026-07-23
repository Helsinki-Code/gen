import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/server/backend-url";

type ComponentStatus = {
  status: "ok" | "error" | "misconfigured";
  latencyMs?: number;
  detail?: string;
};

function isLocalhostUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}

/**
 * Production health hook — verifies runtime backend config and upstream reachability.
 * GET /api/health
 */
export async function GET() {
  const components: Record<string, ComponentStatus> = {};
  let backendUrl = "";

  try {
    backendUrl = getBackendUrl();
    if (isLocalhostUrl(backendUrl)) {
      components.runtime_config = {
        status: "misconfigured",
        detail: "AMROGEN_BACKEND_URL must not point to localhost in production",
      };
    } else {
      components.runtime_config = { status: "ok", detail: "backend URL configured" };
    }
  } catch (error) {
    components.runtime_config = {
      status: "error",
      detail: error instanceof Error ? error.message : "backend URL not configured",
    };
  }

  if (backendUrl && !isLocalhostUrl(backendUrl)) {
    const started = Date.now();
    try {
      const response = await fetch(`${backendUrl}/health`, { cache: "no-store" });
      const latencyMs = Date.now() - started;
      const payload = (await response.json()) as { status?: string };
      if (response.ok && payload.status === "ok") {
        components.backend = { status: "ok", latencyMs };
      } else {
        components.backend = {
          status: "error",
          latencyMs,
          detail: `upstream HTTP ${response.status} status=${payload.status ?? "unknown"}`,
        };
      }
    } catch (error) {
      components.backend = {
        status: "error",
        latencyMs: Date.now() - started,
        detail: error instanceof Error ? error.message : "upstream unreachable",
      };
    }
  }

  const healthy = Object.values(components).every((component) => component.status === "ok");
  return NextResponse.json(
    {
      status: healthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      components,
    },
    { status: healthy ? 200 : 503 }
  );
}
