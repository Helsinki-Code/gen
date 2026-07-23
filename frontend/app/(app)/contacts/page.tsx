"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2, Search, Users, Flame, MessageSquare, CheckCircle,
  Mail, Phone, ArrowUpRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthToken } from "@/lib/auth/use-auth-token";
import { cn } from "@/lib/utils";
import { DataTableFilter } from "@/components/ui/data-table-filter";

interface Contact {
  lead_id: string;
  name: string;
  title: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  icp_fit_score: string | null;
  icp_fit: string | null;
  best_outreach_angle: string | null;
  campaign_id: string;
  campaign_url: string | null;
  sequence_id: string | null;
  sequence_status: string | null;
  last_touch_channel: string | null;
  last_touch_at: string | null;
  next_touch_at: string | null;
  next_touch_day: number | null;
  reply_intent: string | null;
  reply_preview: string | null;
}

interface ContactStats {
  total: number;
  active: number;
  replied: number;
  hot: number;
  converted: number;
}

const INTENT_DOTS: Record<string, string> = {
  HOT: "bg-red-500",
  WARM: "bg-amber-500",
  NEUTRAL: "bg-muted-foreground",
  OBJECTION: "bg-yellow-500",
  OUT_OF_OFFICE: "bg-blue-400",
  UNSUBSCRIBE: "bg-muted-foreground",
};

const SEQ_STATUS_CLS: Record<string, string> = {
  approved: "text-emerald-400",
  active:   "text-emerald-400",
  paused:   "text-amber-400",
  stopped:  "text-muted-foreground",
  pending:  "text-muted-foreground",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDomain(url: string | null) {
  if (!url) return "—";
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

function ContactDrawer({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm glass-panel-elevated border-l border-border shadow-2xl overflow-y-auto">
      <div className="sticky top-0 bg-background/80 backdrop-blur border-b border-border/60 px-5 py-4 flex items-center justify-between">
        <h2 className="font-semibold">{contact.name}</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
      </div>

      <div className="p-5 space-y-5">
        <div className="space-y-2">
          {contact.title && <p className="text-sm text-muted-foreground">{contact.title}</p>}
          {contact.company && <p className="text-sm font-medium">{contact.company}</p>}
          {contact.campaign_url && (
            <Link href={`/campaigns/${contact.campaign_id}`} className="text-xs text-primary hover:underline flex items-center gap-1">
              {formatDomain(contact.campaign_url)} <ArrowUpRight size={11} />
            </Link>
          )}
        </div>

        <div className="space-y-2 text-xs">
          {contact.email && (
            <div className="flex items-center gap-2">
              <Mail size={13} className="text-muted-foreground" />
              <span>{contact.email}</span>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-2">
              <Phone size={13} className="text-muted-foreground" />
              <span>{contact.phone}</span>
            </div>
          )}
        </div>

        {contact.best_outreach_angle && (
          <div className="rounded-lg bg-secondary/40 p-3 text-xs italic text-muted-foreground">
            &ldquo;{contact.best_outreach_angle}&rdquo;
          </div>
        )}

        <div className="rounded-lg border border-border/60 p-3 space-y-2 text-xs">
          <p className="font-semibold text-sm mb-2">Sequence</p>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className={SEQ_STATUS_CLS[contact.sequence_status ?? ""] ?? "text-muted-foreground"}>
              {contact.sequence_status ?? "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Last touch</span>
            <span>{fmtDate(contact.last_touch_at)} {contact.last_touch_channel ? `via ${contact.last_touch_channel}` : ""}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Next touch</span>
            <span>{contact.next_touch_at ? `Day ${contact.next_touch_day ?? "?"} — ${fmtDate(contact.next_touch_at)}` : "—"}</span>
          </div>
        </div>

        {contact.reply_intent && (
          <div className="rounded-lg border border-border/60 p-3 text-xs">
            <p className="font-semibold mb-1 text-sm">Reply</p>
            <div className="flex items-center gap-2 mb-2">
              <span className={cn("w-2 h-2 rounded-full", INTENT_DOTS[contact.reply_intent] ?? "bg-muted-foreground")} />
              <span className="font-medium">{contact.reply_intent}</span>
            </div>
            {contact.reply_preview && <p className="text-muted-foreground italic">{contact.reply_preview}</p>}
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <Link href={`/campaigns/${contact.campaign_id}`}>
            <button className="w-full text-sm py-2 px-3 rounded-lg border border-border hover:bg-secondary/60 transition-colors">
              View in Campaign
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ContactsPage() {
  const getToken = useAuthToken();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [intentFilter, setIntentFilter] = useState("");
  const [selected, setSelected] = useState<Contact | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const [c, s] = await Promise.all([
          api.getContacts(token, { per_page: 100 }),
          api.getContactStats(token),
        ]);
        if (!cancelled) {
          setContacts(c as Contact[]);
          setStats(s);
        }
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [getToken]);

  const filtered = contacts.filter(c => {
    if (statusFilter && c.sequence_status !== statusFilter) return false;
    if (intentFilter && c.reply_intent !== intentFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (c.name?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="p-5 lg:p-7 max-w-6xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold glow-text">Contacts</h1>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: "Total", value: stats.total, icon: Users, color: "text-foreground" },
            { label: "Active", value: stats.active, icon: CheckCircle, color: "text-emerald-400" },
            { label: "Replied", value: stats.replied, icon: MessageSquare, color: "text-blue-400" },
            { label: "HOT", value: stats.hot, icon: Flame, color: "text-red-400" },
            { label: "Converted", value: stats.converted, icon: CheckCircle, color: "text-primary" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="glass-panel rounded-xl p-3 border border-border/60 flex items-center gap-3">
              <Icon size={16} className={color} />
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-lg font-bold ${color}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search name or company…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-secondary/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <DataTableFilter
          label="Status"
          options={[
            { value: "approved", label: "Active" },
            { value: "paused",   label: "Paused" },
            { value: "stopped",  label: "Stopped" },
          ]}
          selectedValues={statusFilter}
          onChange={(vals) => setStatusFilter(vals[0] ?? "")}
        />
        <DataTableFilter
          label="Reply Intent"
          options={[
            { value: "HOT",          label: "🔥 HOT" },
            { value: "WARM",         label: "🌡 WARM" },
            { value: "NEUTRAL",      label: "Neutral" },
            { value: "OBJECTION",    label: "Objection" },
            { value: "OUT_OF_OFFICE",label: "Out of Office" },
          ]}
          selectedValues={intentFilter}
          onChange={(vals) => setIntentFilter(vals[0] ?? "")}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 size={18} className="animate-spin" />
          Loading contacts…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users size={36} className="mx-auto mb-3 opacity-30" />
          <p>No contacts found</p>
        </div>
      ) : (
        <div className="glass-panel rounded-xl border border-border/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-secondary/30">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Company</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Campaign</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Last Touch</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Next Touch</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Reply</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map(c => (
                <tr
                  key={c.lead_id}
                  onClick={() => setSelected(c)}
                  className="hover:bg-secondary/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{c.name}</p>
                    {c.title && <p className="text-xs text-muted-foreground">{c.title}</p>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{c.company ?? "—"}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-muted-foreground">{formatDomain(c.campaign_url)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-medium", SEQ_STATUS_CLS[c.sequence_status ?? ""] ?? "text-muted-foreground")}>
                      {c.sequence_status ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{fmtDate(c.last_touch_at)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                    {c.next_touch_at ? `D${c.next_touch_day} · ${fmtDate(c.next_touch_at)}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {c.reply_intent ? (
                      <span className="flex items-center gap-1.5">
                        <span className={cn("w-2 h-2 rounded-full", INTENT_DOTS[c.reply_intent] ?? "bg-muted-foreground")} />
                        <span className="text-xs">{c.reply_intent}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setSelected(null)} />
          <ContactDrawer contact={selected} onClose={() => setSelected(null)} />
        </>
      )}
    </div>
  );
}
