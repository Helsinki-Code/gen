export type AuthUser = {
  email: string;
  name: string | null;
  isAdmin?: boolean;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export type MfaChallengeResponse = {
  requiresMfa: true;
  tempToken: string;
  methods: string[];
  user: AuthUser;
};

export type MfaSetupRequiredResponse = {
  requiresMfaSetup: true;
  tempToken: string;
  user: AuthUser;
};

export type LoginResult = AuthResponse | MfaChallengeResponse | MfaSetupRequiredResponse;

function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  const message = (payload as { message?: unknown }).message;
  if (typeof message === "string" && message.trim()) return message;
  const error = (payload as { error?: unknown }).error;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

async function authFetch(
  path: string,
  body?: Record<string, unknown>,
  options?: { method?: string; token?: string }
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (options?.token) headers.Authorization = `Bearer ${options.token}`;
  return fetch(path, {
    method: options?.method ?? "POST",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function isMfaChallenge(data: LoginResult): data is MfaChallengeResponse {
  return "requiresMfa" in data && data.requiresMfa === true;
}

export function isMfaSetupRequired(data: LoginResult): data is MfaSetupRequiredResponse {
  return "requiresMfaSetup" in data && data.requiresMfaSetup === true;
}

export async function loginWithPassword(email: string, password: string): Promise<LoginResult> {
  const response = await authFetch("/api/amrogen-auth/sign-in", { email, password });
  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(errorMessage(data, "Unable to sign in. Try again."));
  }
  return data as LoginResult;
}

export async function registerWithPassword(
  name: string,
  email: string,
  password: string
): Promise<LoginResult> {
  const response = await authFetch("/api/amrogen-auth/sign-up", { name, email, password });
  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(errorMessage(data, "Unable to create your account."));
  }
  return data as LoginResult;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const response = await authFetch("/api/amrogen-auth/request-reset", { email });
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    throw new Error(errorMessage(data, "Could not send reset code. Try again."));
  }
}

export async function resetPassword(
  email: string,
  otp: string,
  password: string
): Promise<LoginResult> {
  const response = await authFetch("/api/amrogen-auth/reset-password", { email, otp, password });
  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(errorMessage(data, "Invalid or expired code. Try again."));
  }
  return data as LoginResult;
}

export async function verifyMfa(tempToken: string, code: string): Promise<AuthResponse> {
  const response = await authFetch("/api/amrogen-auth/verify-mfa", { tempToken, code });
  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(errorMessage(data, "Invalid verification code."));
  }
  return data as AuthResponse;
}

export async function sendMfaOtpEmail(tempToken: string): Promise<void> {
  const response = await authFetch("/api/amrogen-auth/send-otp-email", { tempToken });
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    throw new Error(errorMessage(data, "Could not send verification email."));
  }
}

export async function setupMfa(
  tempToken: string,
  method: "email" | "totp" | "both"
): Promise<AuthResponse | { uri: string; secret: string; needsVerify: boolean; message?: string }> {
  const response = await authFetch("/api/amrogen-auth/setup-mfa", { tempToken, method });
  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(errorMessage(data, "MFA setup failed."));
  }
  return data as AuthResponse | { uri: string; secret: string; needsVerify: boolean; message?: string };
}

export async function setupMfaVerify(tempToken: string, code: string): Promise<AuthResponse> {
  const response = await authFetch("/api/amrogen-auth/setup-mfa-verify", { tempToken, code });
  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(errorMessage(data, "Verification failed."));
  }
  return data as AuthResponse;
}

export async function getMfaMethods(tokenOrTemp?: {
  token?: string;
  tempToken?: string;
}): Promise<string[]> {
  const qs = tokenOrTemp?.tempToken
    ? `?tempToken=${encodeURIComponent(tokenOrTemp.tempToken)}`
    : "";
  const response = await authFetch(
    `/api/amrogen-auth/security/mfa-methods${qs}`,
    undefined,
    { method: "GET", token: tokenOrTemp?.token }
  );
  const data: unknown = await response.json().catch(() => ({ methods: [] }));
  if (!response.ok) return [];
  const methods = (data as { methods?: unknown }).methods;
  return Array.isArray(methods) ? methods.filter((m): m is string => typeof m === "string") : [];
}

export async function addTotp(opts?: {
  token?: string;
  tempToken?: string;
}): Promise<{ uri: string; secret: string; needsVerify?: boolean; message?: string }> {
  const response = await authFetch(
    "/api/amrogen-auth/security/add-totp",
    opts?.tempToken ? { tempToken: opts.tempToken } : {},
    { token: opts?.token }
  );
  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(errorMessage(data, "Failed to add authenticator."));
  }
  return data as { uri: string; secret: string; needsVerify?: boolean; message?: string };
}

export async function verifyTotp(
  code: string,
  opts?: { token?: string; tempToken?: string }
): Promise<AuthResponse | { success: true }> {
  const body: Record<string, unknown> = { code };
  if (opts?.tempToken) body.tempToken = opts.tempToken;
  const response = await authFetch("/api/amrogen-auth/security/verify-totp", body, {
    token: opts?.token,
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(errorMessage(data, "Verification failed."));
  }
  return data as AuthResponse | { success: true };
}

export async function addEmailMfa(token: string): Promise<void> {
  const response = await authFetch("/api/amrogen-auth/security/add-email", {}, { token });
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    throw new Error(errorMessage(data, "Failed to add email MFA."));
  }
}

export async function removeMfa(token: string, method: string): Promise<void> {
  const response = await authFetch(
    "/api/amrogen-auth/security/remove-mfa",
    { method },
    { token }
  );
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    throw new Error(errorMessage(data, "Failed to remove MFA method."));
  }
}
