import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  Building2,
  Check,
  ExternalLink,
  MapPin,
  Radar,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import type { IcpProfile } from "../lib/domain/lead";

export function IcpReport({ profile }: { profile: IcpProfile }) {
  return (
    <>
      <a className="settings-back" href="/leads"><ArrowLeft size={15} /> Back to leads</a>

      <section className="icp-hero">
        <div>
          <span className="section-label">IDEAL CUSTOMER PROFILE</span>
          <h2>{profile.name}</h2>
          <p>{profile.summary}</p>
        </div>
        <div className="icp-score">
          <span><Radar size={19} /> Research confidence</span>
          <strong>{profile.confidence}%</strong>
          <small>{profile.evidenceCount} evidence signals considered</small>
        </div>
      </section>

      <section className="icp-profile-grid">
        <article className="icp-company-card">
          <div className="icp-card-heading">
            <span><Building2 size={18} /></span>
            <div><p className="section-label">COMPANY FIT</p><h3>Firmographic shape</h3></div>
          </div>
          <dl>
            <div><dt>Industries</dt><dd>{profile.companyProfile.industries.join(", ")}</dd></div>
            <div><dt>Employees</dt><dd>{profile.companyProfile.employeeRange}</dd></div>
            <div><dt>Revenue</dt><dd>{profile.companyProfile.revenueRange}</dd></div>
            <div><dt>Maturity</dt><dd>{profile.companyProfile.maturity}</dd></div>
            <div><dt><MapPin size={13} /> Geography</dt><dd>{profile.companyProfile.geographies.join(", ")}</dd></div>
          </dl>
        </article>

        <article className="icp-roles-card">
          <div className="icp-card-heading">
            <span><Users size={18} /></span>
            <div><p className="section-label">BUYING COMMITTEE</p><h3>People who feel the problem</h3></div>
          </div>
          <div className="icp-roles">
            {profile.buyerRoles.map((role) => (
              <div key={role.title}>
                <span>{role.priority}</span>
                <strong>{role.title}</strong>
                <p>{role.motivation}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="icp-insight-grid">
        <article>
          <span><Target size={17} /></span>
          <h3>Problems worth solving</h3>
          <ul>{profile.painPoints.map((item) => <li key={item}><Check size={14} /> {item}</li>)}</ul>
        </article>
        <article>
          <span><Sparkles size={17} /></span>
          <h3>Signals that raise priority</h3>
          <ul>{profile.buyingSignals.map((item) => <li key={item}><Check size={14} /> {item}</li>)}</ul>
        </article>
        <article>
          <span><Ban size={17} /></span>
          <h3>Exclusions</h3>
          <ul>{profile.exclusions.map((item) => <li key={item}><Check size={14} /> {item}</li>)}</ul>
        </article>
      </section>

      <section className="icp-evidence">
        <div className="list-heading">
          <div><span>EVIDENCE</span><h2>Why this profile is credible</h2></div>
          <BadgeCheck size={21} />
        </div>
        <div>
          {profile.evidence.map((item) => (
            <article key={item.id}>
              <span>{item.kind}</span>
              <div><h3>{item.sourceTitle}</h3><p>{item.excerpt}</p></div>
              <strong>{item.confidence}%</strong>
              <a href={item.sourceUrl} rel="noreferrer" target="_blank" aria-label={`Open source: ${item.sourceTitle}`}>
                <ExternalLink size={15} />
              </a>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
