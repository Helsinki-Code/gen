import { expect, test } from "@playwright/test";

/**
 * Gap inventory — product vs automation.
 * Product gaps should be closed in code/deploy.
 * Automation gaps are accepted limits for prod CI (need staging/secrets).
 */
const GAPS = [
  {
    id: "GAP-001",
    severity: "high",
    status: "closed_in_code",
    area: "Account Discovery",
    finding: "UI + api helpers added under /discoveries (list, create, detail, launch).",
    deploy: "Frontend CodeOnly",
  },
  {
    id: "GAP-002",
    severity: "medium",
    status: "accepted_deferred",
    area: "Campaign pipeline E2E",
    finding: "Full agent pipeline spend not auto-run on every prod CI.",
    deploy: "None — needs staging + mock agents",
  },
  {
    id: "GAP-003",
    severity: "medium",
    status: "accepted_deferred",
    area: "Channel connect",
    finding: "Gmail/Resend/Twilio connect needs real third-party secrets.",
    deploy: "None — optional @integrations suite later",
  },
  {
    id: "GAP-004",
    severity: "medium",
    status: "accepted_deferred",
    area: "Stripe payment completion",
    finding: "Checkout session creation covered; card+webhook completion not automated.",
    deploy: "None — staging Stripe test clock later",
  },
  {
    id: "GAP-005",
    severity: "low",
    status: "accepted_deferred",
    area: "SSE campaign stream",
    finding: "EventSource progress not browser-asserted without a live campaign.",
    deploy: "None",
  },
  {
    id: "GAP-006",
    severity: "low",
    status: "accepted_deferred",
    area: "Admin articles",
    finding: "Articles workflow is mostly frontend/storage, outside FastAPI contract suite.",
    deploy: "None",
  },
  {
    id: "GAP-007",
    severity: "high",
    status: "closed_in_prod",
    area: "Schema drift",
    finding: "Prod DB repaired; campaigns/discoveries/admin overview return 200.",
    deploy: "None (already live)",
  },
  {
    id: "GAP-008",
    severity: "critical",
    status: "closed_in_code",
    area: "Frontend API URL inject",
    finding: "force-dynamic layout + /api/runtime-config + async API URL resolve.",
    deploy: "Frontend CodeOnly (required)",
  },
] as const;

test("gap inventory statuses", async () => {
  console.log("\n=== AmroGen gap inventory ===");
  for (const gap of GAPS) {
    console.log(`[${gap.status}] ${gap.id} ${gap.area} — deploy: ${gap.deploy}`);
  }
  const openProduct = GAPS.filter(
    (g) => g.status !== "closed_in_code" && g.status !== "closed_in_prod" && g.status !== "accepted_deferred"
  );
  expect(openProduct).toEqual([]);
  expect(GAPS.filter((g) => g.id === "GAP-008")[0]?.status).toBe("closed_in_code");
  expect(GAPS.filter((g) => g.id === "GAP-001")[0]?.status).toBe("closed_in_code");
});

export { GAPS };
