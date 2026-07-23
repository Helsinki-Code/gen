import { NextResponse } from "next/server";
import { apiErrorResponse } from "../../../../lib/server/api-response";
import { getCurrentActor } from "../../../../lib/server/auth-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await getCurrentActor();
    if (!actor) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401, headers: { "Cache-Control": "private, no-store" } },
      );
    }

    return NextResponse.json(
      { authenticated: true, actor },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
