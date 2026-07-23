import { eveChannel } from "eve/channels/eve";
import {
  extractBearerToken,
  ForbiddenError,
  localDev,
  placeholderAuth,
  type AuthFn,
  vercelOidc,
} from "eve/channels/auth";
import { authenticateSessionToken } from "../../lib/server/session-auth";

function vranceflexSession(): AuthFn<Request> {
  return async (request) => {
    const token = extractBearerToken(request.headers.get("authorization"));
    if (!token) return null;

    try {
      const actor = await authenticateSessionToken(token);
      if (!actor) return null;
      if (!actor.organizationId) {
        throw new ForbiddenError({
          code: "organization_required",
          message: "Choose an organization before starting or continuing an agent session.",
        });
      }

      return {
        authenticator: "vranceflex",
        issuer: "vranceflex",
        principalId: actor.userId,
        principalType: "user",
        subject: actor.userId,
        attributes: {
          tenantId: actor.organizationId,
          organizationId: actor.organizationId,
          organizationRole: actor.organizationRole,
          email: actor.email,
        },
      };
    } catch (error) {
      if (error instanceof ForbiddenError) throw error;
      return null;
    }
  };
}

export default eveChannel({
  auth: [
    // Browser callers attach their VranceFlex opaque session token as Bearer.
    // The verified active organization becomes the Eve tenant boundary.
    vranceflexSession(),
    // Lets the eve TUI and your Vercel deployments reach the deployed agent.
    vercelOidc(),
    // Open on localhost for `eve dev` and the REPL; ignored in production.
    localDev(),
    // Fail closed when first-party authentication is not configured.
    placeholderAuth(),
  ],
});
