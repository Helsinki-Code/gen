import { Building2 } from "lucide-react";
import { getCurrentActor } from "../lib/server/auth-store";
import { getDatabase } from "../lib/server/database";
import { organizations } from "../lib/server/database/schema";
import { eq } from "drizzle-orm";
import { LogoutButton } from "./logout-button";

function initials(name: string | null, email: string) {
  const source = name?.trim() || email;
  return source
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export async function AuthWorkspaceControls() {
  const actor = await getCurrentActor();
  if (!actor) return null;

  const [organization] = await getDatabase()
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, actor.organizationId))
    .limit(1);

  return (
    <div className="workspace-controls">
      <a className="workspace-identity" href="/settings/team">
        <Building2 size={14} />
        <span>
          <strong>{organization?.name ?? "Workspace"}</strong>
          <small>{actor.organizationRole}</small>
        </span>
      </a>
      <div className="workspace-user">
        <a href="/settings/account" aria-label="Open account settings">
          {initials(actor.name, actor.email)}
        </a>
        <span>
          <strong>{actor.name ?? actor.email}</strong>
          <small>{actor.email}</small>
        </span>
        <LogoutButton />
      </div>
    </div>
  );
}
