import { Check, CircleDashed, LockKeyhole } from "lucide-react";
import type { IntegrationStatus } from "../lib/server/integration-status";

export function IntegrationStatusGrid({ integrations }: { integrations: IntegrationStatus[] }) {
  return (
    <section className="integration-grid">
      {integrations.map((integration) => (
        <article key={integration.id}>
          <div className="integration-heading">
            <span className={integration.configured ? "configured" : ""}>
              {integration.configured ? <Check size={15} /> : <CircleDashed size={15} />}
            </span>
            <div><h2>{integration.name}</h2><p>{integration.description}</p></div>
          </div>
          <div className="integration-foot">
            <span>{integration.required ? "Required" : "Optional"}</span>
            <strong className={integration.configured ? "configured" : ""}>
              <LockKeyhole size={12} />
              {integration.configured ? "Configured" : "Needs secret"}
            </strong>
          </div>
        </article>
      ))}
    </section>
  );
}
