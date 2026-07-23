"use client";

import {
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  Check,
  ChevronRight,
  CircleDashed,
  Download,
  ExternalLink,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldOff,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  leadStatusLabels,
  type ConfidenceBand,
  type Lead,
  type LeadStatus,
} from "../lib/domain/lead";

type LoadState = "loading" | "ready" | "error";

function buildParams({
  search,
  confidence,
  status,
  contact,
  campaignId,
}: {
  search: string;
  confidence: ConfidenceBand | "";
  status: LeadStatus | "";
  contact: "any" | "email" | "phone";
  campaignId?: string;
}) {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (confidence) params.set("confidence", confidence);
  if (status) params.set("status", status);
  if (contact !== "any") params.set("contact", contact);
  if (campaignId) params.set("campaignId", campaignId);
  return params;
}

function Confidence({ lead }: { lead: Lead }) {
  return (
    <span className={`lead-confidence confidence-${lead.confidenceBand}`}>
      <i />
      {lead.confidence}%
    </span>
  );
}

export function LeadsWorkspace({ campaignId }: { campaignId?: string }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [confidence, setConfidence] = useState<ConfidenceBand | "">("");
  const [status, setStatus] = useState<LeadStatus | "">("");
  const [contact, setContact] = useState<"any" | "email" | "phone">("any");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const params = useMemo(
    () =>
      buildParams({
        search: deferredSearch,
        confidence,
        status,
        contact,
        campaignId,
      }),
    [campaignId, confidence, contact, deferredSearch, status],
  );

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setState("loading");
      setError("");

      try {
        const response = await fetch(`/api/leads?${params.toString()}`, {
          cache: "no-store",
          signal,
        });
        const data = (await response.json()) as {
          leads?: Lead[];
          total?: number;
          error?: string;
        };
        if (!response.ok) throw new Error(data.error ?? "Leads could not be loaded.");
        setLeads(data.leads ?? []);
        setTotal(data.total ?? 0);
        setState("ready");
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Leads could not be loaded.");
        setState("error");
      }
    },
    [params],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const selected = leads.find((lead) => lead.id === selectedId) ?? null;
  const exportHref = `/api/leads/export?${params.toString()}`;
  const hasFilters = Boolean(search || confidence || status || contact !== "any");

  return (
    <>
      <section className="lead-metrics" aria-label="Lead summary">
        <article>
          <span><UserRound size={15} /> Matched leads</span>
          <strong>{state === "ready" ? total : "—"}</strong>
          <small>Scoped to this workspace</small>
        </article>
        <article>
          <span><Sparkles size={15} /> High confidence</span>
          <strong>
            {state === "ready"
              ? leads.filter((lead) => lead.confidenceBand === "high").length
              : "—"}
          </strong>
          <small>80% confidence or higher</small>
        </article>
        <article>
          <span><BadgeCheck size={15} /> Verified email</span>
          <strong>
            {state === "ready"
              ? leads.filter((lead) => lead.emailVerified).length
              : "—"}
          </strong>
          <small>Verification is shown separately</small>
        </article>
        <article>
          <span><ShieldOff size={15} /> Suppressed</span>
          <strong>
            {state === "ready"
              ? leads.filter((lead) => lead.doNotContact).length
              : "—"}
          </strong>
          <small>Never eligible for outreach</small>
        </article>
      </section>

      <section className="leads-panel">
        <div className="leads-toolbar">
          <div>
            <span className="section-label">RESEARCH RESULTS</span>
            <h2>Evidence-backed people</h2>
          </div>
          <div className="lead-toolbar-actions">
            <a className="button-secondary compact" href="/icp">
              View ICP report <ArrowUpRight size={15} />
            </a>
            <a className="button-primary compact" download href={exportHref}>
              <Download size={15} /> Export CSV
            </a>
          </div>
        </div>

        <div className="lead-filters">
          <label className="lead-search">
            <Search size={16} />
            <span className="sr-only">Search leads</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search company, person, title or market"
              type="search"
              value={search}
            />
          </label>
          <label>
            <span className="sr-only">Confidence</span>
            <select
              onChange={(event) =>
                setConfidence(event.target.value as ConfidenceBand | "")
              }
              value={confidence}
            >
              <option value="">All confidence</option>
              <option value="high">High confidence</option>
              <option value="medium">Medium confidence</option>
              <option value="low">Low confidence</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Lead status</span>
            <select
              onChange={(event) => setStatus(event.target.value as LeadStatus | "")}
              value={status}
            >
              <option value="">All statuses</option>
              <option value="new">New</option>
              <option value="qualified">Qualified</option>
              <option value="needs_review">Needs review</option>
              <option value="approved">Approved</option>
              <option value="suppressed">Suppressed</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Contact availability</span>
            <select
              onChange={(event) =>
                setContact(event.target.value as "any" | "email" | "phone")
              }
              value={contact}
            >
              <option value="any">Any contact</option>
              <option value="email">Has email</option>
              <option value="phone">Has phone</option>
            </select>
          </label>
          {hasFilters && (
            <button
              className="clear-filters"
              onClick={() => {
                setSearch("");
                setConfidence("");
                setStatus("");
                setContact("any");
              }}
              type="button"
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>

        {state === "loading" && (
          <div className="lead-state">
            <LoaderCircle className="spin" />
            <h3>Checking current evidence</h3>
            <p>Filtering organization-scoped research without changing lead status.</p>
          </div>
        )}

        {state === "error" && (
          <div className="lead-state error">
            <AlertCircle />
            <h3>Lead research is unavailable</h3>
            <p>{error}</p>
            <button className="button-secondary" onClick={() => void load()} type="button">
              <RefreshCw size={15} /> Retry
            </button>
          </div>
        )}

        {state === "ready" && leads.length === 0 && (
          <div className="lead-state empty">
            <CircleDashed />
            <h3>No leads match these filters</h3>
            <p>Change the filters or wait for research and enrichment to produce evidence.</p>
          </div>
        )}

        {state === "ready" && leads.length > 0 && (
          <div className="lead-table-wrap">
            <table className="lead-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Decision-maker</th>
                  <th>Contact</th>
                  <th>Confidence</th>
                  <th>Status</th>
                  <th><span className="sr-only">View evidence</span></th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr className={lead.doNotContact ? "suppressed" : ""} key={lead.id}>
                    <td data-label="Company">
                      <div className="lead-company">
                        <span>{lead.companyName.slice(0, 2).toUpperCase()}</span>
                        <div>
                          <strong>{lead.companyName}</strong>
                          <small>
                            {lead.industry ?? "Market pending"} · {lead.companySize ?? "Size pending"}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td data-label="Decision-maker">
                      <strong>{lead.personName}</strong>
                      <small>{lead.jobTitle}</small>
                    </td>
                    <td data-label="Contact">
                      <div className="lead-contact">
                        {lead.email ? (
                          <span>
                            <Mail size={13} /> {lead.email}
                            {lead.emailVerified && <Check size={12} />}
                          </span>
                        ) : (
                          <span className="muted">Email unavailable</span>
                        )}
                        {lead.phone && (
                          <span>
                            <Phone size={13} /> {lead.phone}
                            {lead.phoneVerified && <Check size={12} />}
                          </span>
                        )}
                      </div>
                    </td>
                    <td data-label="Confidence"><Confidence lead={lead} /></td>
                    <td data-label="Status">
                      <span className={`lead-status lead-status-${lead.status}`}>
                        {leadStatusLabels[lead.status]}
                      </span>
                    </td>
                    <td>
                      <button
                        aria-label={`Inspect evidence for ${lead.personName} at ${lead.companyName}`}
                        onClick={() => setSelectedId(lead.id)}
                        type="button"
                      >
                        <ChevronRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <div className="lead-detail-backdrop" role="presentation">
          <aside
            aria-label={`Evidence for ${selected.personName}`}
            className="lead-detail"
          >
            <div className="lead-detail-head">
              <div>
                <span className="section-label">LEAD EVIDENCE</span>
                <h2>{selected.personName}</h2>
                <p>{selected.jobTitle} · {selected.companyName}</p>
              </div>
              <button
                aria-label="Close lead evidence"
                onClick={() => setSelectedId(null)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <div className="lead-detail-score">
              <Confidence lead={selected} />
              <span>{selected.evidence.length} source{selected.evidence.length === 1 ? "" : "s"} shown</span>
            </div>

            <dl className="lead-facts">
              <div><dt><Building2 size={14} /> Company</dt><dd>{selected.companyName}</dd></div>
              <div><dt><MapPin size={14} /> Geography</dt><dd>{selected.geography ?? "Not confirmed"}</dd></div>
              <div><dt><UserRound size={14} /> ICP</dt><dd>{selected.icpName ?? "Not assigned"}</dd></div>
            </dl>

            <section className="buying-signals">
              <h3>Buying signals</h3>
              <ul>
                {selected.buyingSignals.map((signal) => (
                  <li key={signal}><Sparkles size={14} /> {signal}</li>
                ))}
              </ul>
            </section>

            <section className="evidence-list">
              <h3>Source evidence</h3>
              {selected.evidence.map((item) => (
                <article key={item.id}>
                  <div>
                    <span>{item.kind}</span>
                    <strong>{item.confidence}%</strong>
                  </div>
                  <h4>{item.sourceTitle}</h4>
                  <p>{item.excerpt}</p>
                  <a href={item.sourceUrl} rel="noreferrer" target="_blank">
                    Open source <ExternalLink size={13} />
                  </a>
                </article>
              ))}
            </section>

            {selected.doNotContact && (
              <div className="suppression-notice">
                <ShieldOff size={17} />
                <p><strong>Do not contact.</strong> This lead is permanently excluded from outreach.</p>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
