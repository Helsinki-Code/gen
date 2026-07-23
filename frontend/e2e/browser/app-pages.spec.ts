import { expect, test, type Page, type Response } from "@playwright/test";
import { browserLogin } from "../helpers/auth";
import { e2eEnv } from "../helpers/env";

type PageProbe = {
  path: string;
  /** Substrings of the Cloud Run API URL that must be requested */
  apiIncludes: string[];
  visible?: RegExp;
};

const APP_PAGES: PageProbe[] = [
  { path: "/dashboard", apiIncludes: ["/admin/overview"], visible: /admin|overview|user|campaign|metric|dashboard/i },
  { path: "/campaigns", apiIncludes: ["/campaigns"], visible: /campaign/i },
  { path: "/campaigns/new", apiIncludes: [], visible: /url|lead|campaign|target/i },
  { path: "/discoveries", apiIncludes: ["/discoveries"], visible: /discover/i },
  { path: "/discoveries/new", apiIncludes: [], visible: /discovery|icp|signal/i },
  { path: "/contacts", apiIncludes: ["/contacts"], visible: /contact/i },
  { path: "/inbox", apiIncludes: ["/inbox"], visible: /inbox|reply|empty|message/i },
  { path: "/podcast-studio", apiIncludes: ["/podcasts"], visible: /podcast/i },
  { path: "/settings/credits", apiIncludes: ["/credits/balance"], visible: /credit|plan|starter|balance/i },
  { path: "/settings/gmail", apiIncludes: ["/gmail/status"], visible: /gmail|connect/i },
  { path: "/settings/resend", apiIncludes: ["/resend/status"], visible: /resend|connect/i },
  { path: "/settings/twilio", apiIncludes: ["/twilio/status"], visible: /twilio|connect|sms/i },
  { path: "/settings/schedule", apiIncludes: ["/settings/schedule"], visible: /schedule|timezone|send/i },
  { path: "/settings/api-keys", apiIncludes: ["/api-keys"], visible: /api.?key/i },
  { path: "/settings/accounts", apiIncludes: ["/gmail/status", "/resend/status", "/twilio/status"], visible: /gmail|resend|twilio|account/i },
  { path: "/admin", apiIncludes: ["/admin/overview"], visible: /admin|overview|user|campaign|metric/i },
  { path: "/admin/users", apiIncludes: ["/admin/users"], visible: /user|email|credit/i },
  { path: "/admin/revenue", apiIncludes: ["/admin/revenue"], visible: /revenue|credit/i },
  { path: "/admin/articles", apiIncludes: [], visible: /article|draft|publish/i },
];

function isCloudRunApi(url: string, apiURL: string): boolean {
  try {
    const apiHost = new URL(apiURL).host;
    return new URL(url).host === apiHost;
  } catch {
    return url.includes("amrogen-backend");
  }
}

async function collectApiCalls(page: Page, path: string, apiIncludes: string[], apiURL: string): Promise<Response[]> {
  const seen: Response[] = [];
  const onResponse = (res: Response) => {
    if (isCloudRunApi(res.url(), apiURL)) seen.push(res);
  };
  page.on("response", onResponse);

  const waiters = apiIncludes.map((needle) =>
    page.waitForResponse(
      (res) => isCloudRunApi(res.url(), apiURL) && res.url().includes(needle),
      { timeout: 45_000 }
    )
  );

  await page.goto(path, { waitUntil: "domcontentloaded" });
  if (waiters.length) {
    await Promise.all(waiters);
  } else {
    await page.waitForTimeout(2000);
  }
  page.off("response", onResponse);

  for (const needle of apiIncludes) {
    const match = seen.find((r) => r.url().includes(needle));
    expect(
      match,
      `${path} should call Cloud Run API ${needle}. Seen: ${seen.map((s) => `${s.status()} ${s.url()}`).join(" | ") || "(none)"}`
    ).toBeTruthy();
    expect(match!.status(), `${path} → ${needle} status`).toBeLessThan(400);
  }
  return seen;
}

test.describe("Browser E2E — app pages call backend", () => {
  test.beforeEach(async ({ page }) => {
    await browserLogin(page);
  });

  for (const probe of APP_PAGES) {
    test(`page ${probe.path} loads and hits API`, async ({ page }) => {
      const { apiURL } = e2eEnv();
      await collectApiCalls(page, probe.path, probe.apiIncludes, apiURL);
      if (probe.visible) {
        await expect(page.locator("body")).toContainText(probe.visible);
      }
      await expect(page.locator("text=Application error")).toHaveCount(0);
      await expect(page.locator("text=Internal Server Error")).toHaveCount(0);
    });
  }
});
