import { expect, test } from "@playwright/test";
import { apiSignIn, authHeaders, bffSignIn } from "./helpers/auth";
import { e2eEnv } from "./helpers/env";

/**
 * Contract suite: every method in frontend/lib/api.ts + auth BFF routes.
 * Mirrors how the UI talks to the backend (front → back).
 */
test.describe.configure({ mode: "serial" });

test.describe("Front→back API contract (lib/api.ts)", () => {
  let token = "";
  let apiURL = "";
  let baseURL = "";

  test.beforeAll(async ({ playwright }) => {
    const env = e2eEnv();
    apiURL = env.apiURL;
    baseURL = env.baseURL;
    const request = await playwright.request.newContext();
    const session = await apiSignIn(request);
    token = session.token;
    await request.dispose();
  });

  async function get(path: string, expectOk = true) {
    const res = await fetch(`${apiURL}${path}`, { headers: authHeaders(token) });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      /* keep text */
    }
    if (expectOk) {
      expect(res.status, `${path} body=${text.slice(0, 200)}`).toBeLessThan(400);
    }
    return { status: res.status, body, text };
  }

  async function send(method: string, path: string, data?: unknown, expectOk = true) {
    const res = await fetch(`${apiURL}${path}`, {
      method,
      headers: authHeaders(token),
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      /* keep text */
    }
    if (expectOk) {
      expect(res.status, `${method} ${path} body=${text.slice(0, 200)}`).toBeLessThan(400);
    }
    return { status: res.status, body, text };
  }

  test("BFF auth proxy sign-in (frontend → Next → backend)", async ({ playwright }) => {
    const request = await playwright.request.newContext();
    const session = await bffSignIn(request);
    expect(session.token).toBeTruthy();
    expect(session.email.toLowerCase()).toBe(e2eEnv().email.toLowerCase());
    await request.dispose();
  });

  test("auth/me", async () => {
    const { body } = await get("/auth/me");
    expect(body).toMatchObject({ email: expect.any(String) });
  });

  test("credits balance + purchase session", async () => {
    const bal = await get("/credits/balance");
    expect(bal.body).toMatchObject({ balance: expect.any(Number) });

    const purchase = await send("POST", "/credits/purchase", { plan: "starter" });
    expect(purchase.body).toMatchObject({
      checkout_url: expect.stringContaining("http"),
      session_id: expect.stringMatching(/^cs_/),
    });
  });

  test("campaigns list", async () => {
    const { body } = await get("/campaigns");
    expect(Array.isArray(body)).toBe(true);
  });

  test("contacts + stats", async () => {
    const contacts = await get("/contacts");
    expect(Array.isArray(contacts.body)).toBe(true);
    const stats = await get("/contacts/stats");
    expect(stats.body).toMatchObject({
      total: expect.any(Number),
      active: expect.any(Number),
    });
  });

  test("inbox + count", async () => {
    const inbox = await get("/inbox");
    expect(Array.isArray(inbox.body)).toBe(true);
    const count = await get("/inbox/count");
    expect(count.body).toMatchObject({
      total: expect.any(Number),
      hot: expect.any(Number),
    });
  });

  test("api-keys list + create + revoke", async () => {
    const before = await get("/api-keys");
    expect(Array.isArray(before.body)).toBe(true);

    const created = await send("POST", "/api-keys", { name: `e2e-${Date.now()}` });
    const id = (created.body as { id?: string }).id;
    expect(id).toBeTruthy();

    const revoked = await send("DELETE", `/api-keys/${id}`);
    expect(revoked.status).toBeLessThan(400);
  });

  test("schedule get + put round-trip", async () => {
    const current = await get("/settings/schedule");
    expect(current.body).toMatchObject({
      enabled: expect.any(Boolean),
      mode: expect.any(String),
    });
    const cfg = current.body as {
      enabled: boolean;
      mode: string;
      send_time: string;
      days: string[];
      timezone: string;
    };
    const updated = await send("PUT", "/settings/schedule", {
      ...cfg,
      enabled: cfg.enabled,
    });
    expect(updated.status).toBeLessThan(400);
  });

  test("gmail / resend / twilio status", async () => {
    const gmail = await get("/gmail/status");
    expect(gmail.body).toMatchObject({ connected: expect.any(Boolean) });

    const gmailAuth = await get("/gmail/auth-url", false);
    // May 200 with URL or 400 if OAuth not configured — must not 500
    expect(gmailAuth.status).not.toBe(500);

    const resend = await get("/resend/status");
    expect(resend.body).toMatchObject({ connected: expect.any(Boolean) });

    const twilio = await get("/twilio/status");
    expect(twilio.body).toMatchObject({ connected: expect.any(Boolean) });
  });

  test("podcasts list + public", async () => {
    const mine = await get("/podcasts");
    expect(Array.isArray(mine.body)).toBe(true);
    const pub = await fetch(`${apiURL}/podcasts/public`);
    expect(pub.status).toBe(200);
  });

  test("admin overview / users / revenue", async () => {
    const overview = await get("/admin/overview");
    expect(overview.body).toMatchObject({ metrics: expect.any(Object) });
    const users = await get("/admin/users");
    expect(users.body).toBeTruthy();
    const revenue = await get("/admin/revenue");
    expect(revenue.body).toMatchObject({ metrics: expect.any(Object) });
  });

  test("discoveries list + helpers surface", async () => {
    const { status, body } = await get("/discoveries");
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  test("health endpoints", async () => {
    const health = await fetch(`${apiURL}/health`);
    expect(health.status).toBe(200);
    const ready = await fetch(`${apiURL}/health/ready`);
    expect(ready.status).toBe(200);
  });

  test("unauthenticated campaigns rejected", async () => {
    const res = await fetch(`${apiURL}/campaigns`);
    expect([401, 403]).toContain(res.status);
  });

  test("frontend origin CORS on API", async () => {
    const res = await fetch(`${apiURL}/auth/me`, {
      headers: { ...authHeaders(token), Origin: baseURL },
    });
    expect(res.status).toBe(200);
    const acao = res.headers.get("access-control-allow-origin");
    expect(acao === baseURL || acao === "*").toBeTruthy();
  });
});
