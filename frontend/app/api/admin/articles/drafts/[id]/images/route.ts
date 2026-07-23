import { NextResponse } from "next/server";
import { generateArticleImagePackage, requireAdminSession } from "@/lib/admin-articles";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireAdminSession();
  if (!user) return NextResponse.json({ detail: "Admin access is required." }, { status: 403 });

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await generateArticleImagePackage(id, String(body.feedback || "")));
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Unable to generate article images." },
      { status: 500 }
    );
  }
}
