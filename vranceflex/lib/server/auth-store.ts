import {
  and,
  desc,
  eq,
  gte,
  isNull,
  lt,
} from "drizzle-orm";
import { cookies } from "next/headers";
import type {
  OtpVerificationInput,
  ResetPasswordInput,
  SigninInput,
  SignupInput,
} from "../domain/auth";
import { normalizeEmail } from "../domain/auth";
import { AUTH_SESSION_COOKIE } from "../auth/config";
import {
  createSessionToken,
  generateOtp,
  hashOtp,
  hashPassword,
  hashSessionToken,
  verifyOtpHash,
  verifyPassword,
} from "./auth-crypto";
import { assertAuthEmailConfigured, sendAuthOtp } from "./auth-email";
import { AuthRequestError } from "./auth-errors";
import { getDatabase } from "./database";
import {
  authChallenges,
  authSessions,
  organizationMemberships,
  organizations,
  users,
} from "./database/schema";
import {
  authenticateSessionToken,
  type AuthenticatedActor,
} from "./session-auth";

const OTP_TTL_MS = 10 * 60 * 1_000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const OTP_WINDOW_MS = 15 * 60 * 1_000;
const MAX_OTP_SENDS_PER_WINDOW = 5;
const MAX_OTP_ATTEMPTS = 5;

export { authenticateSessionToken };
export type { AuthenticatedActor };

function sessionExpiry() {
  return new Date(Date.now() + SESSION_TTL_MS);
}

function challengeExpiry() {
  return new Date(Date.now() + OTP_TTL_MS);
}

async function enforceOtpRateLimit(userId: string) {
  const database = getDatabase();
  const recent = await database
    .select({ id: authChallenges.id })
    .from(authChallenges)
    .where(
      and(
        eq(authChallenges.userId, userId),
        gte(authChallenges.createdAt, new Date(Date.now() - OTP_WINDOW_MS)),
      ),
    );

  if (recent.length >= MAX_OTP_SENDS_PER_WINDOW) {
    throw new AuthRequestError(
      "Too many verification codes were requested. Try again in 15 minutes.",
      429,
    );
  }
}

async function createChallenge({
  userId,
  email,
  kind,
  metadata = {},
}: {
  userId: string;
  email: string;
  kind: "signup_verification" | "password_reset";
  metadata?: { organizationName?: string };
}) {
  await enforceOtpRateLimit(userId);
  const database = getDatabase();
  const code = generateOtp();
  const now = new Date();

  await database.transaction(async (transaction) => {
    const consumed = await transaction
      .update(authChallenges)
      .set({ consumedAt: now })
      .where(
        and(
          eq(authChallenges.userId, userId),
          eq(authChallenges.kind, kind),
          isNull(authChallenges.consumedAt),
        ),
      )
      .returning({ id: authChallenges.id });

    if (consumed.length !== 1) {
      throw new AuthRequestError(
        "This verification code was already used.",
        409,
      );
    }

    await transaction.insert(authChallenges).values({
      id: crypto.randomUUID(),
      userId,
      kind,
      codeHash: hashOtp(userId, kind, code),
      expiresAt: challengeExpiry(),
      metadata,
    });
  });

  await sendAuthOtp({ to: email, code, kind });
}

async function createSessionRecord({
  userId,
  organizationId,
}: {
  userId: string;
  organizationId: string;
}) {
  const token = createSessionToken();
  await getDatabase().insert(authSessions).values({
    id: crypto.randomUUID(),
    tokenHash: hashSessionToken(token),
    userId,
    organizationId,
    expiresAt: sessionExpiry(),
  });
  return token;
}

export async function beginSignup(input: SignupInput) {
  assertAuthEmailConfigured();
  const database = getDatabase();
  const normalizedEmail = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);

  const userId = await database.transaction(async (transaction) => {
    const [existing] = await transaction
      .select()
      .from(users)
      .where(eq(users.normalizedEmail, normalizedEmail))
      .limit(1);

    if (existing?.emailVerifiedAt) {
      throw new AuthRequestError(
        "An account already exists for this email. Sign in instead.",
        409,
      );
    }

    if (existing) {
      await transaction
        .update(users)
        .set({
          email: input.email.trim(),
          name: input.name,
          passwordHash,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id));
      return existing.id;
    }

    const id = crypto.randomUUID();
    await transaction.insert(users).values({
      id,
      email: input.email.trim(),
      normalizedEmail,
      passwordHash,
      name: input.name,
    });
    return id;
  });

  await createChallenge({
    userId,
    email: input.email.trim(),
    kind: "signup_verification",
    metadata: { organizationName: input.organizationName },
  });

  return { email: input.email.trim() };
}

async function latestChallenge(
  normalizedEmail: string,
  kind: "signup_verification" | "password_reset",
) {
  const database = getDatabase();
  const [record] = await database
    .select({ challenge: authChallenges, user: users })
    .from(authChallenges)
    .innerJoin(users, eq(authChallenges.userId, users.id))
    .where(
      and(
        eq(users.normalizedEmail, normalizedEmail),
        eq(authChallenges.kind, kind),
        isNull(authChallenges.consumedAt),
      ),
    )
    .orderBy(desc(authChallenges.createdAt))
    .limit(1);
  return record ?? null;
}

async function verifyChallenge(
  input: OtpVerificationInput,
  kind: "signup_verification" | "password_reset",
) {
  const database = getDatabase();
  const record = await latestChallenge(normalizeEmail(input.email), kind);

  if (!record || record.challenge.expiresAt <= new Date()) {
    throw new AuthRequestError(
      "This verification code is invalid or has expired.",
      400,
    );
  }

  if (record.challenge.attempts >= MAX_OTP_ATTEMPTS) {
    throw new AuthRequestError(
      "Too many incorrect attempts. Request a new code.",
      429,
    );
  }

  if (
    !verifyOtpHash(
      record.user.id,
      kind,
      input.code,
      record.challenge.codeHash,
    )
  ) {
    await database
      .update(authChallenges)
      .set({ attempts: record.challenge.attempts + 1 })
      .where(eq(authChallenges.id, record.challenge.id));
    throw new AuthRequestError(
      "This verification code is invalid or has expired.",
      400,
    );
  }

  return record;
}

export async function verifySignup(input: OtpVerificationInput) {
  const database = getDatabase();
  const record = await verifyChallenge(input, "signup_verification");
  const organizationId = crypto.randomUUID();
  const organizationName =
    record.challenge.metadata.organizationName?.trim() || "My workspace";
  const now = new Date();

  await database.transaction(async (transaction) => {
    const consumed = await transaction
      .update(authChallenges)
      .set({ consumedAt: now })
      .where(
        and(
          eq(authChallenges.id, record.challenge.id),
          isNull(authChallenges.consumedAt),
        ),
      )
      .returning({ id: authChallenges.id });

    if (consumed.length !== 1) {
      throw new AuthRequestError(
        "This verification code was already used.",
        409,
      );
    }

    await transaction
      .update(users)
      .set({ emailVerifiedAt: now, updatedAt: now })
      .where(eq(users.id, record.user.id));

    await transaction.insert(organizations).values({
      id: organizationId,
      name: organizationName,
    });

    await transaction.insert(organizationMemberships).values({
      organizationId,
      userId: record.user.id,
      role: "admin",
    });
  });

  return {
    token: await createSessionRecord({
      userId: record.user.id,
      organizationId,
    }),
  };
}

export async function resendSignupOtp(email: string) {
  assertAuthEmailConfigured();
  const normalizedEmail = normalizeEmail(email);
  const database = getDatabase();
  const [user] = await database
    .select()
    .from(users)
    .where(eq(users.normalizedEmail, normalizedEmail))
    .limit(1);

  if (!user || user.emailVerifiedAt || !user.email) {
    return { email };
  }

  const previous = await latestChallenge(
    normalizedEmail,
    "signup_verification",
  );
  await createChallenge({
    userId: user.id,
    email: user.email,
    kind: "signup_verification",
    metadata: previous?.challenge.metadata ?? {},
  });
  return { email: user.email };
}

export async function signIn(input: SigninInput) {
  const database = getDatabase();
  const normalizedEmail = normalizeEmail(input.email);
  const [user] = await database
    .select()
    .from(users)
    .where(eq(users.normalizedEmail, normalizedEmail))
    .limit(1);

  if (
    !user?.passwordHash ||
    !(await verifyPassword(input.password, user.passwordHash))
  ) {
    throw new AuthRequestError("Email or password is incorrect.", 401);
  }

  if (!user.emailVerifiedAt) {
    throw new AuthRequestError(
      "Verify your email before signing in.",
      403,
    );
  }

  const [membership] = await database
    .select()
    .from(organizationMemberships)
    .where(eq(organizationMemberships.userId, user.id))
    .orderBy(organizationMemberships.createdAt)
    .limit(1);

  if (!membership) {
    throw new AuthRequestError(
      "This account is not connected to a workspace.",
      403,
    );
  }

  return {
    token: await createSessionRecord({
      userId: user.id,
      organizationId: membership.organizationId,
    }),
  };
}

export async function beginPasswordReset(email: string) {
  assertAuthEmailConfigured();
  const database = getDatabase();
  const normalizedEmail = normalizeEmail(email);
  const [user] = await database
    .select()
    .from(users)
    .where(eq(users.normalizedEmail, normalizedEmail))
    .limit(1);

  if (user?.email && user.emailVerifiedAt) {
    await createChallenge({
      userId: user.id,
      email: user.email,
      kind: "password_reset",
    });
  }

  return { accepted: true };
}

export async function resetPassword(input: ResetPasswordInput) {
  const database = getDatabase();
  const record = await verifyChallenge(input, "password_reset");
  const passwordHash = await hashPassword(input.password);
  const now = new Date();

  await database.transaction(async (transaction) => {
    await transaction
      .update(authChallenges)
      .set({ consumedAt: now })
      .where(
        and(
          eq(authChallenges.id, record.challenge.id),
          isNull(authChallenges.consumedAt),
        ),
      );

    await transaction
      .update(users)
      .set({ passwordHash, updatedAt: now })
      .where(eq(users.id, record.user.id));

    await transaction
      .update(authSessions)
      .set({ revokedAt: now })
      .where(
        and(
          eq(authSessions.userId, record.user.id),
          isNull(authSessions.revokedAt),
        ),
      );
  });

  return { reset: true };
}

export async function updateProfile(
  actor: AuthenticatedActor,
  input: { name: string },
) {
  await getDatabase()
    .update(users)
    .set({ name: input.name, updatedAt: new Date() })
    .where(eq(users.id, actor.userId));
  return { name: input.name };
}

export async function currentSessionToken() {
  return (await cookies()).get(AUTH_SESSION_COOKIE)?.value ?? "";
}

export async function getCurrentActor() {
  return authenticateSessionToken(await currentSessionToken());
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(AUTH_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: sessionExpiry(),
  });
}

export async function revokeCurrentSession() {
  const token = await currentSessionToken();
  if (token) {
    await getDatabase()
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(authSessions.tokenHash, hashSessionToken(token)),
          isNull(authSessions.revokedAt),
        ),
      );
  }
  (await cookies()).delete(AUTH_SESSION_COOKIE);
}

export async function removeExpiredAuthRecords() {
  const database = getDatabase();
  const now = new Date();
  await database.delete(authChallenges).where(lt(authChallenges.expiresAt, now));
  await database.delete(authSessions).where(lt(authSessions.expiresAt, now));
}
