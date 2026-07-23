import { NextResponse } from "next/server";
import { requireAdminSession, suggestInternalLinks } from "@/lib/admin-articles";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireAdminSession();
  if (!user) return NextResponse.json({ detail: "Admin access is required." }, { status: 403 });

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const urls = Array.isArray(body.urls) ? body.urls.map(String) : [];
    return NextResponse.json({ suggestions: suggestInternalLinks(id, urls) });
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Unable to suggest internal links." },
      { status: 500 }
    );
  }
}
