import { redirect } from "next/navigation";
import { isDemoModeEnabled } from "./config";
import { getCurrentActor } from "../server/auth-store";

export async function requireWorkspacePage() {
  if (isDemoModeEnabled()) {
    return {
      userId: "demo-user",
      organizationId: "demo-organization",
      organizationRole: "admin" as const,
      email: "demo@vranceflex.local",
      name: "Demo user",
      demo: true,
    };
  }

  const actor = await getCurrentActor();
  if (!actor) redirect("/sign-in");

  return {
    ...actor,
    demo: false,
  };
}
