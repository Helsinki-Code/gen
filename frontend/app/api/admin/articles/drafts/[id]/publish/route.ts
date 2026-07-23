import { NextResponse } from "next/server";
import { publishDraft, requireAdminSession } from "@/lib/admin-articles";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const user = await requireAdminSession();
  if (!user) {
    return NextResponse.json({ detail: "Admin access is required." }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const draft = publishDraft(id);
    return NextResponse.json({ draft });
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Unable to publish article draft." },
      { status: 500 }
    );
  }
}
