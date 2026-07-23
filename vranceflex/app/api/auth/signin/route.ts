import { NextResponse } from "next/server";
import { signinSchema } from "../../../../lib/domain/auth";
import { apiErrorResponse } from "../../../../lib/server/api-response";
import {
  setSessionCookie,
  signIn,
} from "../../../../lib/server/auth-store";
import { assertSameOrigin } from "../../../../lib/server/request-security";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = signinSchema.parse(await request.json());
    const { token } = await signIn(input);
    await setSessionCookie(token);
    return NextResponse.json({ authenticated: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
