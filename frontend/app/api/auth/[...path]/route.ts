import { NextResponse } from "next/server";

// Neon Auth removed — this endpoint no longer exists.
export function GET() {
  return NextResponse.json({ error: "Not found" }, { status: 410 });
}
export const POST = GET;
export const PUT = GET;
export const DELETE = GET;
export const PATCH = GET;
