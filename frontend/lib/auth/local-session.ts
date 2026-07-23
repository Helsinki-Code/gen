"use client";

type StoredUser = {
  email?: string | null;
  name?: string | null;
};

type StoredAuth = {
  token: string;
  user: StoredUser;
  expiresAt: number;
};

const TOKEN_KEY = "amrogen-auth-token";
const USER_KEY = "amrogen-auth-user";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = window.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function tokenExpiresAt(token: string) {
  const payload = decodeJwtPayload(token);
  const exp = typeof payload?.exp === "number" ? payload.exp : 0;
  return exp ? exp * 1000 : Date.now() + 10 * 60 * 1000;
}

export function saveLocalAuth(token: string, user: StoredUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(
    USER_KEY,
    JSON.stringify({ token, user, expiresAt: tokenExpiresAt(token) } satisfies StoredAuth)
  );
}

export function readLocalAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed.token || parsed.expiresAt <= Date.now() + 15_000) {
      clearLocalAuth();
      return null;
    }
    return parsed;
  } catch {
    clearLocalAuth();
    return null;
  }
}

export function clearLocalAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}
