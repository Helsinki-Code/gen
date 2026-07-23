import { NextResponse } from "next/server";
import { apiErrorResponse } from "../../../../lib/server/api-response";
import { revokeCurrentSession } from "../../../../lib/server/auth-store";
import { assertSameOrigin } from "../../../../lib/server/request-security";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await revokeCurrentSession();
    return NextResponse.json({ signedOut: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
