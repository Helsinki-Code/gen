import { NextResponse } from "next/server";
import { resetPasswordSchema } from "../../../../lib/domain/auth";
import { apiErrorResponse } from "../../../../lib/server/api-response";
import { resetPassword } from "../../../../lib/server/auth-store";
import { assertSameOrigin } from "../../../../lib/server/request-security";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = resetPasswordSchema.parse(await request.json());
    await resetPassword(input);
    return NextResponse.json({ reset: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
