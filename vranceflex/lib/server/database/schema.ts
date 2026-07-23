import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { Campaign } from "../../domain/campaign";
import { campaignStatuses } from "../../domain/campaign";
import type { IcpProfile, Lead } from "../../domain/lead";
import { evidenceKinds, leadStatuses } from "../../domain/lead";

export const campaignStatusEnum = pgEnum("campaign_status", campaignStatuses);
export const campaignSourceKindEnum = pgEnum("campaign_source_kind", ["website", "product_idea"]);
export const membershipRoleEnum = pgEnum("membership_role", [
  "admin",
  "member",
  "reviewer",
  "billing",
]);
export const approvalScopeEnum = pgEnum("approval_scope", ["first_launch", "batch"]);
export const leadStatusEnum = pgEnum("lead_status", leadStatuses);
export const evidenceKindEnum = pgEnum("evidence_kind", evidenceKinds);
export const authChallengeKindEnum = pgEnum("auth_challenge_kind", [
  "signup_verification",
  "password_reset",
]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  normalizedEmail: text("normalized_email"),
  passwordHash: text("password_hash"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("users_normalized_email_unique").on(table.normalizedEmail),
]);

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: membershipRoleEnum("role").default("member").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.userId] })],
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("auth_sessions_token_hash_unique").on(table.tokenHash),
    index("auth_sessions_user_idx").on(table.userId),
    index("auth_sessions_org_idx").on(table.organizationId),
    index("auth_sessions_expiry_idx").on(table.expiresAt),
  ],
);

export const authChallenges = pgTable(
  "auth_challenges",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: authChallengeKindEnum("kind").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<{ organizationName?: string }>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("auth_challenges_user_kind_idx").on(
      table.userId,
      table.kind,
      table.createdAt,
    ),
    index("auth_challenges_expiry_idx").on(table.expiresAt),
  ],
);

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    idempotencyKey: text("idempotency_key").notNull(),
    businessName: text("business_name").notNull(),
    productName: text("product_name").notNull(),
    productSummary: text("product_summary").notNull(),
    sourceKind: campaignSourceKindEnum("source_kind").notNull(),
    source: jsonb("source").$type<Campaign["source"]>().notNull(),
    audience: text("audience").notNull(),
    geography: text("geography").notNull(),
    goal: text("goal").notNull(),
    leadCount: integer("lead_count").notNull(),
    monthlyBudgetUsd: integer("monthly_budget_usd").notNull(),
    channels: jsonb("channels").$type<Campaign["channels"]>().notNull(),
    status: campaignStatusEnum("status").default("researching").notNull(),
    providerSendReference: text("provider_send_reference"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("campaigns_org_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    index("campaigns_org_created_idx").on(table.organizationId, table.createdAt),
    index("campaigns_org_status_idx").on(table.organizationId, table.status),
  ],
);

export const icpProfiles = pgTable(
  "icp_profiles",
  {
    id: uuid("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    summary: text("summary").notNull(),
    confidence: integer("confidence").notNull(),
    companyProfile: jsonb("company_profile")
      .$type<IcpProfile["companyProfile"]>()
      .notNull(),
    buyerRoles: jsonb("buyer_roles").$type<IcpProfile["buyerRoles"]>().notNull(),
    painPoints: jsonb("pain_points").$type<string[]>().notNull(),
    buyingSignals: jsonb("buying_signals").$type<string[]>().notNull(),
    exclusions: jsonb("exclusions").$type<string[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("icp_profiles_org_campaign_idx").on(table.organizationId, table.campaignId),
    index("icp_profiles_org_created_idx").on(table.organizationId, table.createdAt),
  ],
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    icpProfileId: uuid("icp_profile_id").references(() => icpProfiles.id, {
      onDelete: "set null",
    }),
    sourceProvider: text("source_provider").notNull(),
    sourceLeadId: text("source_lead_id").notNull(),
    companyName: text("company_name").notNull(),
    companyDomain: text("company_domain"),
    companySize: text("company_size"),
    industry: text("industry"),
    geography: text("geography"),
    personName: text("person_name").notNull(),
    jobTitle: text("job_title").notNull(),
    email: text("email"),
    emailVerified: boolean("email_verified").default(false).notNull(),
    phone: text("phone"),
    phoneVerified: boolean("phone_verified").default(false).notNull(),
    linkedinUrl: text("linkedin_url"),
    confidence: integer("confidence").notNull(),
    status: leadStatusEnum("status").default("new").notNull(),
    doNotContact: boolean("do_not_contact").default(false).notNull(),
    buyingSignals: jsonb("buying_signals").$type<Lead["buyingSignals"]>().default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("leads_org_source_unique").on(
      table.organizationId,
      table.sourceProvider,
      table.sourceLeadId,
    ),
    index("leads_org_campaign_idx").on(table.organizationId, table.campaignId),
    index("leads_org_confidence_idx").on(table.organizationId, table.confidence),
    index("leads_org_status_idx").on(table.organizationId, table.status),
  ],
);

export const enrichmentEvidence = pgTable(
  "enrichment_evidence",
  {
    id: uuid("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    icpProfileId: uuid("icp_profile_id").references(() => icpProfiles.id, {
      onDelete: "cascade",
    }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    kind: evidenceKindEnum("kind").notNull(),
    provider: text("provider").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceTitle: text("source_title").notNull(),
    excerpt: text("excerpt").notNull(),
    confidence: integer("confidence").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("evidence_org_campaign_idx").on(table.organizationId, table.campaignId),
    index("evidence_lead_idx").on(table.leadId),
    index("evidence_icp_idx").on(table.icpProfileId),
  ],
);

export const approvalRecords = pgTable(
  "approval_records",
  {
    id: uuid("id").primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    approvedBy: text("approved_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    scope: approvalScopeEnum("scope").notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("approvals_campaign_idx").on(table.campaignId),
    index("approvals_org_idx").on(table.organizationId),
  ],
);

export const usageLedger = pgTable(
  "usage_ledger",
  {
    id: uuid("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    quantity: integer("quantity").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("usage_org_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    index("usage_org_occurred_idx").on(table.organizationId, table.occurredAt),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_org_occurred_idx").on(table.organizationId, table.occurredAt),
    index("audit_entity_idx").on(table.entityType, table.entityId),
  ],
);
