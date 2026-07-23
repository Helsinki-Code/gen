import { NextResponse } from "next/server";
import { generateDraftAudio, requireAdminSession } from "@/lib/admin-articles";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const user = await requireAdminSession();
  if (!user) return NextResponse.json({ detail: "Admin access is required." }, { status: 403 });

  try {
    const { id } = await context.params;
    const audioUrl = await generateDraftAudio(id);
    return NextResponse.json({ audioUrl });
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Unable to generate article audio." },
      { status: 500 }
    );
  }
}
