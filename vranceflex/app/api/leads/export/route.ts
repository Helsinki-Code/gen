import { leadQuerySchema } from "../../../../lib/domain/lead";
import { getApiActor } from "../../../../lib/server/api-actor";
import { apiErrorResponse } from "../../../../lib/server/api-response";
import { listLeadsForExport } from "../../../../lib/server/lead-store";

export const dynamic = "force-dynamic";

function csvCell(value: string | number | boolean | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  try {
    const actor = await getApiActor();
    const searchParams = new URL(request.url).searchParams;
    const parsed = leadQuerySchema.parse({
      ...Object.fromEntries(searchParams.entries()),
      limit: 100,
      offset: 0,
    });
    const { limit: _limit, offset: _offset, ...query } = parsed;
    const leads = await listLeadsForExport(actor, query);
    const header = [
      "Company",
      "Domain",
      "Industry",
      "Company size",
      "Geography",
      "Contact",
      "Title",
      "Email",
      "Email verified",
      "Phone",
      "Phone verified",
      "LinkedIn",
      "Confidence",
      "Status",
      "Do not contact",
      "Buying signals",
      "Evidence sources",
    ];
    const rows = leads.map((lead) => [
      lead.companyName,
      lead.companyDomain,
      lead.industry,
      lead.companySize,
      lead.geography,
      lead.personName,
      lead.jobTitle,
      lead.email,
      lead.emailVerified,
      lead.phone,
      lead.phoneVerified,
      lead.linkedinUrl,
      lead.confidence,
      lead.status,
      lead.doNotContact,
      lead.buyingSignals.join(" | "),
      lead.evidence.map((item) => item.sourceUrl).join(" | "),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((value) => csvCell(value)).join(","))
      .join("\r\n");
    const date = new Date().toISOString().slice(0, 10);

    return new Response(`\uFEFF${csv}`, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="vranceflex-leads-${date}.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
