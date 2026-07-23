import { NextResponse } from "next/server";
import { leadQuerySchema } from "../../../lib/domain/lead";
import { getApiActor } from "../../../lib/server/api-actor";
import { apiErrorResponse } from "../../../lib/server/api-response";
import { listLeads } from "../../../lib/server/lead-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await getApiActor();
    const searchParams = new URL(request.url).searchParams;
    const query = leadQuerySchema.parse(Object.fromEntries(searchParams.entries()));
    const result = await listLeads(actor, query);

    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
