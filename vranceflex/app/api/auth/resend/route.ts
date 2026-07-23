import { NextResponse } from "next/server";
import { forgotPasswordSchema } from "../../../../lib/domain/auth";
import { apiErrorResponse } from "../../../../lib/server/api-response";
import { resendSignupOtp } from "../../../../lib/server/auth-store";
import { assertSameOrigin } from "../../../../lib/server/request-security";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { email } = forgotPasswordSchema.parse(await request.json());
    await resendSignupOtp(email);
    return NextResponse.json({ accepted: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
