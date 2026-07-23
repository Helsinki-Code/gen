import { NextResponse } from "next/server";
import { getDraftDetail, requireAdminSession } from "@/lib/admin-articles";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireAdminSession();
  if (!user) return NextResponse.json({ detail: "Admin access is required." }, { status: 403 });

  try {
    const { id } = await context.params;
    return NextResponse.json(getDraftDetail(id));
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Unable to load draft." },
      { status: 500 }
    );
  }
}
