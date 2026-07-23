import { NextResponse } from "next/server";
import { signupSchema } from "../../../../lib/domain/auth";
import { apiErrorResponse } from "../../../../lib/server/api-response";
import { beginSignup } from "../../../../lib/server/auth-store";
import { assertSameOrigin } from "../../../../lib/server/request-security";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = signupSchema.parse(await request.json());
    const result = await beginSignup(input);
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
