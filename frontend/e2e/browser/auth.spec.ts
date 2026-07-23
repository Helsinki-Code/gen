import { expect, test } from "@playwright/test";
import { browserLogin } from "../helpers/auth";

test.describe("Browser E2E — auth + shell (front→BFF→API)", () => {
  test("sign-in form calls BFF and lands on admin/dashboard", async ({ page }) => {
    const session = await browserLogin(page);
    expect(session.token).toBeTruthy();
    await expect(page).toHaveURL(/\/(admin|dashboard)/);
  });

  test("bad password shows error and stays on sign-in", async ({ page }) => {
    await page.goto("/sign-in");
    await page.locator("#email").fill("hemant@joshi.me");
    await page.locator("#password").fill("DefinitelyWrongPassword!!!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("text=/unable|invalid|password|try again/i").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveURL(/sign-in/);
  });
});
