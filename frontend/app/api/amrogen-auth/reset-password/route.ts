import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/server/backend-url";

export async function POST(request: NextRequest) {
  const body = await request.json() as { email?: string; otp?: string; password?: string };

  const upstream = await fetch(`${getBackendUrl()}/auth/reset-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: body.email, otp: body.otp, password: body.password }),
    cache: "no-store",
  });

  const data = await upstream.json() as Record<string, unknown>;
  return NextResponse.json(data, { status: upstream.status });
}
