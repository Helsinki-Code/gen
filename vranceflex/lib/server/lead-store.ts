import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  lt,
  or,
  type SQL,
} from "drizzle-orm";
import {
  confidenceBand,
  type IcpProfile,
  type Lead,
  type LeadEvidence,
  type LeadQuery,
} from "../domain/lead";
import { isDemoModeEnabled } from "../auth/config";
import type { ApiActor } from "./api-actor";
import { DatabaseConfigurationError, getDatabase, hasDatabaseConfiguration } from "./database";
import {
  enrichmentEvidence,
  icpProfiles,
  leads,
} from "./database/schema";
import { demoIcpProfile, demoLeads } from "./demo-leads";
import { ensureActorRecords } from "./identity-store";

function requirePersistenceMode() {
  if (hasDatabaseConfiguration()) return "database" as const;
  if (isDemoModeEnabled()) return "memory" as const;
  throw new DatabaseConfigurationError(
    "DATABASE_URL is required for durable production lead and ICP storage.",
  );
}

function matchesDemoFilters(lead: Lead, query: LeadQuery) {
  const search = query.search.toLocaleLowerCase();
  if (
    search &&
    ![
      lead.companyName,
      lead.personName,
      lead.jobTitle,
      lead.industry ?? "",
      lead.geography ?? "",
    ].some((value) => value.toLocaleLowerCase().includes(search))
  ) {
    return false;
  }

  if (query.campaignId && lead.campaignId !== query.campaignId) return false;
  if (query.confidence && lead.confidenceBand !== query.confidence) return false;
  if (query.status && lead.status !== query.status) return false;
  if (query.contact === "email" && !lead.email) return false;
  if (query.contact === "phone" && !lead.phone) return false;
  return true;
}

function mapEvidence(row: typeof enrichmentEvidence.$inferSelect): LeadEvidence {
  return {
    id: row.id,
    kind: row.kind,
    provider: row.provider,
    sourceUrl: row.sourceUrl,
    sourceTitle: row.sourceTitle,
    excerpt: row.excerpt,
    confidence: row.confidence,
    observedAt: row.observedAt.toISOString(),
  };
}

function mapLead(
  row: typeof leads.$inferSelect,
  icpName: string | null,
  evidence: LeadEvidence[],
): Lead {
  return {
    id: row.id,
    organizationId: row.organizationId,
    campaignId: row.campaignId,
    icpProfileId: row.icpProfileId,
    icpName,
    companyName: row.companyName,
    companyDomain: row.companyDomain,
    companySize: row.companySize,
    industry: row.industry,
    geography: row.geography,
    personName: row.personName,
    jobTitle: row.jobTitle,
    email: row.email,
    emailVerified: row.emailVerified,
    phone: row.phone,
    phoneVerified: row.phoneVerified,
    linkedinUrl: row.linkedinUrl,
    confidence: row.confidence,
    confidenceBand: confidenceBand(row.confidence),
    status: row.status,
    doNotContact: row.doNotContact,
    buyingSignals: row.buyingSignals,
    evidence,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildLeadConditions(actor: ApiActor, query: LeadQuery): SQL[] {
  const conditions: SQL[] = [eq(leads.organizationId, actor.organizationId)];

  if (query.campaignId) conditions.push(eq(leads.campaignId, query.campaignId));
  if (query.status) conditions.push(eq(leads.status, query.status));
  if (query.contact === "email") conditions.push(isNotNull(leads.email));
  if (query.contact === "phone") conditions.push(isNotNull(leads.phone));

  if (query.confidence === "high") conditions.push(gte(leads.confidence, 80));
  if (query.confidence === "medium") {
    conditions.push(gte(leads.confidence, 60), lt(leads.confidence, 80));
  }
  if (query.confidence === "low") conditions.push(lt(leads.confidence, 60));

  if (query.search) {
    const pattern = `%${query.search}%`;
    const searchCondition = or(
      ilike(leads.companyName, pattern),
      ilike(leads.personName, pattern),
      ilike(leads.jobTitle, pattern),
      ilike(leads.industry, pattern),
      ilike(leads.geography, pattern),
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  return conditions;
}

export async function listLeads(actor: ApiActor, query: LeadQuery) {
  if (requirePersistenceMode() === "memory") {
    const filtered = demoLeads.filter((lead) => matchesDemoFilters(lead, query));
    return {
      leads: filtered.slice(query.offset, query.offset + query.limit),
      total: filtered.length,
    };
  }

  await ensureActorRecords(actor);
  const database = getDatabase();
  const conditions = buildLeadConditions(actor, query);
  const where = and(...conditions);

  const [totalRow] = await database
    .select({ value: count() })
    .from(leads)
    .where(where);

  const rows = await database
    .select({ lead: leads, icpName: icpProfiles.name })
    .from(leads)
    .leftJoin(
      icpProfiles,
      and(
        eq(leads.icpProfileId, icpProfiles.id),
        eq(icpProfiles.organizationId, actor.organizationId),
      ),
    )
    .where(where)
    .orderBy(desc(leads.confidence), asc(leads.companyName))
    .limit(query.limit)
    .offset(query.offset);

  const ids = rows.map(({ lead }) => lead.id);
  const evidenceRows =
    ids.length === 0
      ? []
      : await database
          .select()
          .from(enrichmentEvidence)
          .where(
            and(
              eq(enrichmentEvidence.organizationId, actor.organizationId),
              inArray(enrichmentEvidence.leadId, ids),
            ),
          )
          .orderBy(desc(enrichmentEvidence.confidence));

  const evidenceByLead = new Map<string, LeadEvidence[]>();
  for (const row of evidenceRows) {
    if (!row.leadId) continue;
    const items = evidenceByLead.get(row.leadId) ?? [];
    items.push(mapEvidence(row));
    evidenceByLead.set(row.leadId, items);
  }

  return {
    leads: rows.map(({ lead, icpName }) =>
      mapLead(lead, icpName, evidenceByLead.get(lead.id) ?? []),
    ),
    total: totalRow?.value ?? 0,
  };
}

export async function listLeadsForExport(
  actor: ApiActor,
  query: Omit<LeadQuery, "limit" | "offset">,
) {
  const exported: Lead[] = [];
  let offset = 0;

  while (exported.length < 5_000) {
    const page = await listLeads(actor, { ...query, limit: 100, offset });
    exported.push(...page.leads);
    offset += page.leads.length;
    if (offset >= page.total || page.leads.length === 0) break;
  }

  return exported;
}

function mapIcp(
  row: typeof icpProfiles.$inferSelect,
  evidence: LeadEvidence[],
): IcpProfile {
  return {
    id: row.id,
    organizationId: row.organizationId,
    campaignId: row.campaignId,
    name: row.name,
    summary: row.summary,
    confidence: row.confidence,
    evidenceCount: evidence.length,
    companyProfile: row.companyProfile,
    buyerRoles: row.buyerRoles,
    painPoints: row.painPoints,
    buyingSignals: row.buyingSignals,
    exclusions: row.exclusions,
    evidence,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getIcpProfile(actor: ApiActor, campaignId?: string) {
  if (requirePersistenceMode() === "memory") {
    return !campaignId || campaignId === demoIcpProfile.campaignId ? demoIcpProfile : null;
  }

  await ensureActorRecords(actor);
  const database = getDatabase();
  const conditions: SQL[] = [eq(icpProfiles.organizationId, actor.organizationId)];
  if (campaignId) conditions.push(eq(icpProfiles.campaignId, campaignId));

  const [profile] = await database
    .select()
    .from(icpProfiles)
    .where(and(...conditions))
    .orderBy(desc(icpProfiles.updatedAt))
    .limit(1);

  if (!profile) return null;

  const evidenceRows = await database
    .select()
    .from(enrichmentEvidence)
    .where(
      and(
        eq(enrichmentEvidence.organizationId, actor.organizationId),
        eq(enrichmentEvidence.icpProfileId, profile.id),
      ),
    )
    .orderBy(desc(enrichmentEvidence.confidence));

  return mapIcp(profile, evidenceRows.map(mapEvidence));
}
