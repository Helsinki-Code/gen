import { expect, test } from "@playwright/test";
import { e2eEnv } from "../helpers/env";

/**
 * Guards the critical front→back wiring: every app HTML shell must expose the API URL
 * (layout inject) or the runtime-config endpoint must return it.
 */
test.describe("Frontend runtime API wiring", () => {
  for (const path of ["/", "/sign-in", "/dashboard", "/admin", "/campaigns"]) {
    test(`HTML shell ${path} exposes API URL inject`, async ({ request }) => {
      const { apiURL } = e2eEnv();
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      const html = await res.text();
      const hasInject = html.includes("__AMROGEN_API_URL__") && html.includes(new URL(apiURL).host);
      expect(
        hasInject,
        `${path} missing window.__AMROGEN_API_URL__ for ${apiURL}. Redeploy frontend with force-dynamic layout.`
      ).toBe(true);
    });
  }

  test("/api/runtime-config returns apiUrl", async ({ request }) => {
    const { apiURL } = e2eEnv();
    const res = await request.get("/api/runtime-config");
    // Before redeploy this may 404 — that is itself a gap signal
    if (res.status() === 404) {
      test.info().annotations.push({
        type: "gap",
        description: "runtime-config route not deployed yet",
      });
      expect(res.status(), "Deploy frontend so /api/runtime-config exists").not.toBe(404);
      return;
    }
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { apiUrl?: string };
    expect(body.apiUrl).toContain(new URL(apiURL).host);
  });
});
