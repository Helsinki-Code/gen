import { NextResponse } from "next/server";
import { generateKeywordIdeas, requireAdminSession } from "@/lib/admin-articles";

export async function POST(request: Request) {
  const user = await requireAdminSession();
  if (!user) {
    return NextResponse.json({ detail: "Admin access is required." }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const count = Math.max(1, Math.min(Number(body.count || 3), 10));
    const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 300) : "";
    const keywords = await generateKeywordIdeas(topic, count);
    return NextResponse.json({ keywords, count: keywords.length });
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Unable to generate keyword ideas." },
      { status: 500 }
    );
  }
}
