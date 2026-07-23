import { NextResponse } from "next/server";
import { requireAdminSession, runDueSchedule } from "@/lib/admin-articles";

export async function POST(request: Request) {
  const user = await requireAdminSession();
  if (!user) {
    return NextResponse.json({ detail: "Admin access is required." }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const result = await runDueSchedule(Boolean(body.force));
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Unable to run article scheduler." },
      { status: 500 }
    );
  }
}
