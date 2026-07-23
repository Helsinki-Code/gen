/**
 * E2E environment helpers.
 * Credentials must come from env — never commit real passwords.
 */
export function e2eEnv() {
  const baseURL = process.env.E2E_BASE_URL || "https://amrogen.com";
  const apiURL =
    process.env.E2E_API_URL || "https://amrogen-backend-zgoudwucaq-ew.a.run.app";
  const email = process.env.E2E_EMAIL || "hemant@joshi.me";
  const password = process.env.E2E_PASSWORD || "";

  if (!password) {
    throw new Error(
      "E2E_PASSWORD is required. Example: $env:E2E_PASSWORD='…'; npx playwright test"
    );
  }

  return { baseURL, apiURL, email, password };
}
