import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/server/backend-url";

export async function POST(request: NextRequest) {
  const body = await request.json() as { email?: string };

  const upstream = await fetch(`${getBackendUrl()}/auth/request-password-reset`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: body.email }),
    cache: "no-store",
  });

  const data = await upstream.json() as Record<string, unknown>;
  return NextResponse.json(data, { status: upstream.status });
}
