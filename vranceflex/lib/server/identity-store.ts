import type { ApiActor } from "./api-actor";
import { getDatabase } from "./database";
import {
  organizationMemberships,
  organizations,
  users,
} from "./database/schema";

export async function ensureActorRecords(actor: ApiActor) {
  const database = getDatabase();

  await database
    .insert(users)
    .values({ id: actor.userId, email: actor.email })
    .onConflictDoNothing({ target: users.id });

  await database
    .insert(organizations)
    .values({ id: actor.organizationId, name: "VranceFlex workspace" })
    .onConflictDoNothing({ target: organizations.id });

  await database
    .insert(organizationMemberships)
    .values({
      organizationId: actor.organizationId,
      userId: actor.userId,
      role: actor.organizationRole,
    })
    .onConflictDoUpdate({
      target: [organizationMemberships.organizationId, organizationMemberships.userId],
      set: { role: actor.organizationRole, updatedAt: new Date() },
    });
}
