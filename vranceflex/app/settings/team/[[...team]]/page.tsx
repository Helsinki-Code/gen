import { and, eq } from "drizzle-orm";
import { ArrowLeft, ShieldCheck, UsersRound } from "lucide-react";
import { AppShell } from "../../../../components/app-shell";
import { isAuthConfigured } from "../../../../lib/auth/config";
import { requireWorkspacePage } from "../../../../lib/auth/page-actor";
import { getDatabase } from "../../../../lib/server/database";
import {
  organizationMemberships,
  organizations,
  users,
} from "../../../../lib/server/database/schema";

export const metadata = { title: "Team settings · VranceFlex" };
export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  const actor = await requireWorkspacePage();
  const database = getDatabase();
  const [workspace] = await database
    .select()
    .from(organizations)
    .where(eq(organizations.id, actor.organizationId))
    .limit(1);
  const members = await database
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: organizationMemberships.role,
      verifiedAt: users.emailVerifiedAt,
    })
    .from(organizationMemberships)
    .innerJoin(
      users,
      and(
        eq(users.id, organizationMemberships.userId),
        eq(organizationMemberships.organizationId, actor.organizationId),
      ),
    )
    .where(eq(organizationMemberships.organizationId, actor.organizationId));

  return (
    <AppShell
      activeHref="/settings"
      authConfigured={isAuthConfigured()}
      eyebrow="WORKSPACE CONTROL"
      title="Team"
    >
      <a className="settings-back" href="/settings">
        <ArrowLeft size={15} /> All settings
      </a>
      <section className="team-settings-card">
        <div className="team-settings-head">
          <span><UsersRound size={20} /></span>
          <div>
            <p className="section-label">ORGANIZATION</p>
            <h2>{workspace?.name ?? "Workspace"}</h2>
            <p>Every campaign, lead and approval is isolated to this organization.</p>
          </div>
        </div>
        <div className="team-member-list">
          {members.map((member) => (
            <article key={member.id}>
              <span>{(member.name ?? member.email ?? "U").slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>{member.name ?? "Workspace member"}</strong>
                <small>{member.email}</small>
              </div>
              <em>{member.role}</em>
              <i><ShieldCheck size={14} /> {member.verifiedAt ? "Verified" : "Pending"}</i>
            </article>
          ))}
        </div>
      </section>
      <div className="truth-banner">
        <ShieldCheck size={18} />
        <p><strong>Permissions enforced server-side.</strong> Membership roles are read from Neon for every authenticated request.</p>
      </div>
    </AppShell>
  );
}
