import { and, desc, eq } from "drizzle-orm";
import type { Campaign, CampaignCreateInput } from "../domain/campaign";
import { isDemoModeEnabled } from "../auth/config";
import type { ApiActor } from "./api-actor";
import {
  DatabaseConfigurationError,
  getDatabase,
  hasDatabaseConfiguration,
} from "./database";
import {
  approvalRecords,
  auditEvents,
  campaigns,
} from "./database/schema";
import { ensureActorRecords } from "./identity-store";

type MemoryState = {
  campaigns: Map<string, Campaign>;
  idempotency: Map<string, string>;
};

declare global {
  // eslint-disable-next-line no-var
  var __vranceflexCampaignStore: MemoryState | undefined;
}

function memoryState(): MemoryState {
  if (!globalThis.__vranceflexCampaignStore) {
    globalThis.__vranceflexCampaignStore = {
      campaigns: new Map(),
      idempotency: new Map(),
    };
  }

  return globalThis.__vranceflexCampaignStore;
}

function requirePersistenceMode() {
  if (hasDatabaseConfiguration()) return "database" as const;
  if (isDemoModeEnabled()) return "memory" as const;
  throw new DatabaseConfigurationError(
    "DATABASE_URL is required for durable production campaign storage.",
  );
}

function mapCampaign(
  row: typeof campaigns.$inferSelect,
  approvals: Array<typeof approvalRecords.$inferSelect> = [],
): Campaign {
  return {
    id: row.id,
    organizationId: row.organizationId,
    createdBy: row.createdBy,
    businessName: row.businessName,
    productName: row.productName,
    productSummary: row.productSummary,
    source: row.source,
    audience: row.audience,
    geography: row.geography,
    goal: row.goal as Campaign["goal"],
    leadCount: row.leadCount as Campaign["leadCount"],
    monthlyBudgetUsd: row.monthlyBudgetUsd,
    channels: row.channels,
    status: row.status,
    providerSendReference: row.providerSendReference,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    approvals: approvals.map((approval) => ({
      id: approval.id,
      approvedBy: approval.approvedBy,
      approvedAt: approval.approvedAt.toISOString(),
      scope: approval.scope,
    })),
  };
}

export async function listCampaigns(actor: ApiActor) {
  if (requirePersistenceMode() === "memory") {
    return Array.from(memoryState().campaigns.values())
      .filter((campaign) => campaign.organizationId === actor.organizationId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  await ensureActorRecords(actor);
  const rows = await getDatabase()
    .select()
    .from(campaigns)
    .where(eq(campaigns.organizationId, actor.organizationId))
    .orderBy(desc(campaigns.createdAt));
  return rows.map((row) => mapCampaign(row));
}

export async function getCampaign(id: string, actor: ApiActor) {
  if (requirePersistenceMode() === "memory") {
    const campaign = memoryState().campaigns.get(id);
    return campaign?.organizationId === actor.organizationId ? campaign : null;
  }

  await ensureActorRecords(actor);
  const [row] = await getDatabase()
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.organizationId, actor.organizationId)))
    .limit(1);

  if (!row) return null;
  const approvals = await getDatabase()
    .select()
    .from(approvalRecords)
    .where(
      and(
        eq(approvalRecords.campaignId, id),
        eq(approvalRecords.organizationId, actor.organizationId),
      ),
    );
  return mapCampaign(row, approvals);
}

export async function createCampaign(
  input: CampaignCreateInput,
  actor: ApiActor,
  idempotencyKey: string,
) {
  if (requirePersistenceMode() === "memory") {
    const store = memoryState();
    const scopedKey = `${actor.organizationId}:${idempotencyKey}`;
    const existingId = store.idempotency.get(scopedKey);
    if (existingId) return store.campaigns.get(existingId) ?? null;

    const now = new Date().toISOString();
    const campaign: Campaign = {
      ...input,
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      createdBy: actor.userId,
      status: "researching",
      createdAt: now,
      updatedAt: now,
      approvals: [],
      providerSendReference: null,
    };
    store.campaigns.set(campaign.id, campaign);
    store.idempotency.set(scopedKey, campaign.id);
    return campaign;
  }

  await ensureActorRecords(actor);
  const database = getDatabase();
  const campaignId = crypto.randomUUID();
  const now = new Date();

  return database.transaction(async (transaction) => {
    await transaction
      .insert(campaigns)
      .values({
        id: campaignId,
        organizationId: actor.organizationId,
        createdBy: actor.userId,
        idempotencyKey,
        businessName: input.businessName,
        productName: input.productName,
        productSummary: input.productSummary,
        sourceKind: input.source.kind,
        source: input.source,
        audience: input.audience,
        geography: input.geography,
        goal: input.goal,
        leadCount: input.leadCount,
        monthlyBudgetUsd: input.monthlyBudgetUsd,
        channels: input.channels,
        status: "researching",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({
        target: [campaigns.organizationId, campaigns.idempotencyKey],
      });

    const [persisted] = await transaction
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.organizationId, actor.organizationId),
          eq(campaigns.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);

    if (!persisted) throw new Error("Campaign could not be persisted.");

    if (persisted.id === campaignId) {
      await transaction.insert(auditEvents).values({
        id: crypto.randomUUID(),
        organizationId: actor.organizationId,
        actorId: actor.userId,
        campaignId,
        action: "campaign.created",
        entityType: "campaign",
        entityId: campaignId,
        metadata: { sourceKind: input.source.kind, status: "researching" },
      });
    }

    return mapCampaign(persisted);
  });
}
