import { z } from "zod";

export const campaignStatuses = [
  "draft",
  "researching",
  "enriching",
  "copy_generated",
  "awaiting_approval",
  "scheduled",
  "sent",
  "delivered",
  "replied",
  "stopped",
] as const;

export const campaignStatusSchema = z.enum(campaignStatuses);
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;

export const campaignStatusLabels: Record<CampaignStatus, string> = {
  draft: "Draft",
  researching: "Researching",
  enriching: "Enriching",
  copy_generated: "Copy Generated",
  awaiting_approval: "Awaiting Approval",
  scheduled: "Scheduled",
  sent: "Sent",
  delivered: "Delivered",
  replied: "Replied",
  stopped: "Stopped",
};

export const campaignSourceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("website"),
    url: z.string().url("Enter a complete website URL, including https://"),
  }),
  z.object({
    kind: z.literal("product_idea"),
    ideaName: z.string().trim().min(2, "Give the idea a short name").max(80),
    description: z
      .string()
      .trim()
      .min(30, "Describe the idea, customer and problem in a little more detail")
      .max(2_000),
    stage: z.enum(["concept", "prototype", "mvp", "launched"]),
  }),
]);

export const campaignCreateSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  productName: z.string().trim().min(2).max(120),
  productSummary: z.string().trim().min(30).max(2_000),
  source: campaignSourceSchema,
  audience: z.string().trim().min(10).max(1_000),
  geography: z.string().trim().min(2).max(160),
  goal: z.enum(["book_meetings", "validate_demand", "build_waitlist", "sell_product"]),
  leadCount: z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)]),
  monthlyBudgetUsd: z.number().int().min(100).max(100_000),
  channels: z.array(z.enum(["email", "sms"])).min(1),
});

export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;

export const approvalRecordSchema = z.object({
  id: z.string(),
  approvedBy: z.string(),
  approvedAt: z.string().datetime(),
  scope: z.enum(["first_launch", "batch"]),
});

export const campaignSchema = campaignCreateSchema.extend({
  id: z.string(),
  organizationId: z.string(),
  createdBy: z.string(),
  status: campaignStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  approvals: z.array(approvalRecordSchema),
  providerSendReference: z.string().nullable(),
});

export type Campaign = z.infer<typeof campaignSchema>;

export const transitionSources = ["user", "system", "provider", "reply_webhook"] as const;
export type TransitionSource = (typeof transitionSources)[number];

const allowedTransitions: Record<CampaignStatus, readonly CampaignStatus[]> = {
  draft: ["researching", "stopped"],
  researching: ["enriching", "stopped"],
  enriching: ["copy_generated", "stopped"],
  copy_generated: ["awaiting_approval", "stopped"],
  awaiting_approval: ["scheduled", "stopped"],
  scheduled: ["sent", "stopped"],
  sent: ["delivered", "replied", "stopped"],
  delivered: ["replied", "stopped"],
  replied: ["stopped"],
  stopped: [],
};

export function assertCampaignTransition(
  campaign: Campaign,
  nextStatus: CampaignStatus,
  source: TransitionSource,
) {
  if (!allowedTransitions[campaign.status].includes(nextStatus)) {
    throw new Error(
      `Campaign cannot move from ${campaignStatusLabels[campaign.status]} to ${campaignStatusLabels[nextStatus]}.`,
    );
  }

  if (nextStatus === "scheduled" && campaign.approvals.length === 0) {
    throw new Error("Campaign approval is required before scheduling.");
  }

  if ((nextStatus === "sent" || nextStatus === "delivered") && source !== "provider") {
    throw new Error(`${campaignStatusLabels[nextStatus]} requires confirmation from a delivery provider.`);
  }

  if (nextStatus === "replied" && source !== "reply_webhook" && source !== "provider") {
    throw new Error("Replied requires a verified inbound provider event.");
  }
}

export function isCampaignActive(status: CampaignStatus) {
  return !["replied", "stopped"].includes(status);
}
