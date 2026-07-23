import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Public runtime config for the browser when the root-layout inject
 * was missing from a statically cached HTML shell.
 */
export async function GET() {
  const apiUrl = (
    process.env.AMROGEN_BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    ""
  ).replace(/\/$/, "");

  return NextResponse.json(
    { apiUrl },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
