import { NextResponse } from "next/server";
import { otpVerificationSchema } from "../../../../lib/domain/auth";
import { apiErrorResponse } from "../../../../lib/server/api-response";
import {
  setSessionCookie,
  verifySignup,
} from "../../../../lib/server/auth-store";
import { assertSameOrigin } from "../../../../lib/server/request-security";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = otpVerificationSchema.parse(await request.json());
    const { token } = await verifySignup(input);
    await setSessionCookie(token);
    return NextResponse.json({ verified: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
