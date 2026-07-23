import { isDemoModeEnabled } from "../auth/config";
import { getCurrentActor } from "./auth-store";

export type ApiActor = {
  userId: string;
  organizationId: string;
  organizationRole: "admin" | "member" | "reviewer" | "billing";
  email?: string;
};

export class ApiConfigurationError extends Error {}
export class ApiAuthenticationError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
  ) {
    super(message);
  }
}

export async function getApiActor(): Promise<ApiActor> {
  if (isDemoModeEnabled()) {
    return {
      userId: "demo-user",
      organizationId: "demo-organization",
      organizationRole: "admin",
      email: "demo@vranceflex.local",
    };
  }

  const actor = await getCurrentActor();
  if (!actor) {
    throw new ApiAuthenticationError("Sign in to continue.", 401);
  }

  return actor;
}
