import { and, eq, gt, isNull } from "drizzle-orm";
import { hashSessionToken } from "./auth-crypto";
import { getDatabase } from "./database";
import {
  authSessions,
  organizationMemberships,
  users,
} from "./database/schema";

export type AuthenticatedActor = {
  userId: string;
  organizationId: string;
  organizationRole: "admin" | "member" | "reviewer" | "billing";
  email: string;
  name: string | null;
};

export async function authenticateSessionToken(
  token: string,
): Promise<AuthenticatedActor | null> {
  if (!token) return null;
  const database = getDatabase();
  const now = new Date();
  const [record] = await database
    .select({
      session: authSessions,
      user: users,
      membership: organizationMemberships,
    })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .innerJoin(
      organizationMemberships,
      and(
        eq(organizationMemberships.userId, authSessions.userId),
        eq(
          organizationMemberships.organizationId,
          authSessions.organizationId,
        ),
      ),
    )
    .where(
      and(
        eq(authSessions.tokenHash, hashSessionToken(token)),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, now),
      ),
    )
    .limit(1);

  if (!record?.user.emailVerifiedAt || !record.user.email) return null;

  if (record.session.lastSeenAt < new Date(Date.now() - 5 * 60 * 1_000)) {
    await database
      .update(authSessions)
      .set({ lastSeenAt: now })
      .where(eq(authSessions.id, record.session.id));
  }

  return {
    userId: record.user.id,
    organizationId: record.session.organizationId,
    organizationRole: record.membership.role,
    email: record.user.email,
    name: record.user.name,
  };
}
