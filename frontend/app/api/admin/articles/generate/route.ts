import { NextResponse } from "next/server";
import { createArticleDrafts, requireAdminSession } from "@/lib/admin-articles";

export async function POST(request: Request) {
  const user = await requireAdminSession();
  if (!user) {
    return NextResponse.json({ detail: "Admin access is required." }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const count = Math.max(1, Math.min(Number(body.count || 1), 5));
    const keyword = typeof body.keyword === "string" && body.keyword ? body.keyword : undefined;
    const drafts = await createArticleDrafts(count, keyword);
    return NextResponse.json({ drafts, count: drafts.length });
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Unable to generate article drafts." },
      { status: 500 }
    );
  }
}
