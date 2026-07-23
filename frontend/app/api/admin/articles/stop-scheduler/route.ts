import { NextResponse } from "next/server";
import { requireAdminSession, stopActiveScheduler } from "@/lib/admin-articles";

export async function POST() {
  const user = await requireAdminSession();
  if (!user) {
    return NextResponse.json({ detail: "Admin access is required." }, { status: 403 });
  }

  return NextResponse.json(stopActiveScheduler());
}
