import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/server/backend-url";

type ProxyOptions = {
  method?: string;
  path: string;
  body?: unknown;
  authorization?: string | null;
  searchParams?: URLSearchParams;
};

export async function proxyAmrogenAuth({
  method = "POST",
  path,
  body,
  authorization,
  searchParams,
}: ProxyOptions): Promise<NextResponse> {
  const qs = searchParams?.toString();
  const url = `${getBackendUrl()}${path}${qs ? `?${qs}` : ""}`;
  const headers: Record<string, string> = {};
  if (authorization) headers.authorization = authorization;
  if (body !== undefined) headers["content-type"] = "application/json";

  const upstream = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const data = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(data, { status: upstream.status });
}

export async function readJsonBody(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await request.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // empty body
  }
  return {};
}
