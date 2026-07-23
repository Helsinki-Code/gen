import type { APIRequestContext, Page } from "@playwright/test";
import { e2eEnv } from "./env";

export type AuthSession = {
  token: string;
  email: string;
};

/** Sign in via backend (same contract the BFF proxies). */
export async function apiSignIn(request: APIRequestContext): Promise<AuthSession> {
  const { apiURL, email, password } = e2eEnv();
  const res = await request.post(`${apiURL}/auth/sign-in`, {
    data: { email, password },
  });
  if (!res.ok()) {
    throw new Error(`API sign-in failed: ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as { token?: string; user?: { email?: string } };
  if (!body.token) throw new Error("API sign-in response missing token");
  return { token: body.token, email: body.user?.email || email };
}

/** Sign in via frontend BFF (true front→back path). */
export async function bffSignIn(request: APIRequestContext): Promise<AuthSession> {
  const { baseURL, email, password } = e2eEnv();
  const res = await request.post(`${baseURL}/api/amrogen-auth/sign-in`, {
    data: { email, password },
  });
  if (!res.ok()) {
    throw new Error(`BFF sign-in failed: ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as { token?: string; user?: { email?: string } };
  if (!body.token) throw new Error("BFF sign-in response missing token");
  return { token: body.token, email: body.user?.email || email };
}

/**
 * Inject auth the same way the app does after login
 * (localStorage + cookie) then open an app route.
 */
export async function browserLogin(page: Page): Promise<AuthSession> {
  const { baseURL, email, password } = e2eEnv();

  await page.goto(`${baseURL}/sign-in`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);

  const bffResponse = page.waitForResponse(
    (r) => r.url().includes("/api/amrogen-auth/sign-in") && r.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Sign in" }).click();
  const res = await bffResponse;
  if (!res.ok()) {
    throw new Error(`UI sign-in BFF failed: ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as { token?: string };
  if (!body.token) throw new Error("UI sign-in missing token");

  await page.waitForURL(/\/(admin|dashboard)/, { timeout: 30_000 });
  return { token: body.token, email };
}

export function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}
