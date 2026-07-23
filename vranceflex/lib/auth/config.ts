export const AUTH_SESSION_COOKIE = "vranceflex_session";

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function isAuthConfigured() {
  return Boolean(
    isDatabaseConfigured() &&
      process.env.AUTH_SECRET?.trim() &&
      process.env.AUTH_SECRET.trim().length >= 32,
  );
}

export function isResendConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() &&
      process.env.RESEND_FROM_EMAIL?.trim(),
  );
}

export function isDemoModeEnabled() {
  return (
    !isDatabaseConfigured() &&
    (process.env.NODE_ENV !== "production" ||
      process.env.VRANCEFLEX_DEMO_MODE === "true")
  );
}
