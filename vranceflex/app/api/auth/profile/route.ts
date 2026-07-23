import { NextResponse } from "next/server";
import { profileUpdateSchema } from "../../../../lib/domain/auth";
import { apiErrorResponse } from "../../../../lib/server/api-response";
import { ApiAuthenticationError } from "../../../../lib/server/api-actor";
import {
  getCurrentActor,
  updateProfile,
} from "../../../../lib/server/auth-store";
import { assertSameOrigin } from "../../../../lib/server/request-security";

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await getCurrentActor();
    if (!actor) {
      throw new ApiAuthenticationError("Sign in to continue.", 401);
    }
    const input = profileUpdateSchema.parse(await request.json());
    return NextResponse.json(await updateProfile(actor, input));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
