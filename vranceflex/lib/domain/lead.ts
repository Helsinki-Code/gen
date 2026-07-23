import { z } from "zod";

export const leadStatuses = [
  "new",
  "qualified",
  "needs_review",
  "approved",
  "suppressed",
] as const;

export const leadStatusSchema = z.enum(leadStatuses);
export type LeadStatus = z.infer<typeof leadStatusSchema>;

export const leadStatusLabels: Record<LeadStatus, string> = {
  new: "New",
  qualified: "Qualified",
  needs_review: "Needs review",
  approved: "Approved",
  suppressed: "Suppressed",
};

export const confidenceBands = ["high", "medium", "low"] as const;
export const confidenceBandSchema = z.enum(confidenceBands);
export type ConfidenceBand = z.infer<typeof confidenceBandSchema>;

export function confidenceBand(score: number): ConfidenceBand {
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  return "low";
}

export const evidenceKinds = ["company", "person", "contact", "intent"] as const;
export const evidenceKindSchema = z.enum(evidenceKinds);
export type EvidenceKind = z.infer<typeof evidenceKindSchema>;

export const leadEvidenceSchema = z.object({
  id: z.string(),
  kind: evidenceKindSchema,
  provider: z.string(),
  sourceUrl: z.string().url(),
  sourceTitle: z.string(),
  excerpt: z.string(),
  confidence: z.number().int().min(0).max(100),
  observedAt: z.string().datetime(),
});

export type LeadEvidence = z.infer<typeof leadEvidenceSchema>;

export const leadSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  campaignId: z.string(),
  icpProfileId: z.string().nullable(),
  icpName: z.string().nullable(),
  companyName: z.string(),
  companyDomain: z.string().nullable(),
  companySize: z.string().nullable(),
  industry: z.string().nullable(),
  geography: z.string().nullable(),
  personName: z.string(),
  jobTitle: z.string(),
  email: z.string().email().nullable(),
  emailVerified: z.boolean(),
  phone: z.string().nullable(),
  phoneVerified: z.boolean(),
  linkedinUrl: z.string().url().nullable(),
  confidence: z.number().int().min(0).max(100),
  confidenceBand: confidenceBandSchema,
  status: leadStatusSchema,
  doNotContact: z.boolean(),
  buyingSignals: z.array(z.string()),
  evidence: z.array(leadEvidenceSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Lead = z.infer<typeof leadSchema>;

export const icpProfileSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  campaignId: z.string(),
  name: z.string(),
  summary: z.string(),
  confidence: z.number().int().min(0).max(100),
  evidenceCount: z.number().int().min(0),
  companyProfile: z.object({
    industries: z.array(z.string()),
    employeeRange: z.string(),
    revenueRange: z.string(),
    maturity: z.string(),
    geographies: z.array(z.string()),
  }),
  buyerRoles: z.array(
    z.object({
      title: z.string(),
      priority: z.enum(["primary", "secondary", "influencer"]),
      motivation: z.string(),
    }),
  ),
  painPoints: z.array(z.string()),
  buyingSignals: z.array(z.string()),
  exclusions: z.array(z.string()),
  evidence: z.array(leadEvidenceSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type IcpProfile = z.infer<typeof icpProfileSchema>;

export const leadQuerySchema = z.object({
  campaignId: z.string().uuid().optional(),
  search: z.string().trim().max(120).optional().default(""),
  confidence: confidenceBandSchema.optional(),
  status: leadStatusSchema.optional(),
  contact: z.enum(["any", "email", "phone"]).optional().default("any"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type LeadQuery = z.infer<typeof leadQuerySchema>;

export const icpQuerySchema = z.object({
  campaignId: z.string().uuid().optional(),
});
