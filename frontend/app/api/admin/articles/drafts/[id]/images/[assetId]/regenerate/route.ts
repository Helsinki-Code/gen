import { NextResponse } from "next/server";
import { regenerateDraftImage, requireAdminSession } from "@/lib/admin-articles";

interface RouteContext {
  params: Promise<{ id: string; assetId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireAdminSession();
  if (!user) return NextResponse.json({ detail: "Admin access is required." }, { status: 403 });

  try {
    const { id, assetId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const asset = await regenerateDraftImage(id, assetId, String(body.feedback || ""));
    return NextResponse.json({ asset });
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Unable to regenerate image." },
      { status: 500 }
    );
  }
}
