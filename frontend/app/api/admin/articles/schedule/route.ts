import { NextResponse } from "next/server";
import { requireAdminSession, saveSchedule } from "@/lib/admin-articles";

export async function POST(request: Request) {
  const user = await requireAdminSession();
  if (!user) {
    return NextResponse.json({ detail: "Admin access is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const cadence = ["hourly", "six_hours", "daily"].includes(body.cadence)
    ? body.cadence
    : "daily";
  const schedule = saveSchedule({
    enabled: Boolean(body.enabled),
    cadence,
    articlesPerRun: Number(body.articlesPerRun || 1),
  });

  return NextResponse.json({ schedule });
}
