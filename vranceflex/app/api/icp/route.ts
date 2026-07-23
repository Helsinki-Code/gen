import { NextResponse } from "next/server";
import { icpQuerySchema } from "../../../lib/domain/lead";
import { getApiActor } from "../../../lib/server/api-actor";
import { apiErrorResponse } from "../../../lib/server/api-response";
import { getIcpProfile } from "../../../lib/server/lead-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await getApiActor();
    const searchParams = new URL(request.url).searchParams;
    const { campaignId } = icpQuerySchema.parse(
      Object.fromEntries(searchParams.entries()),
    );
    const profile = await getIcpProfile(actor, campaignId);

    return NextResponse.json(
      { profile },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
