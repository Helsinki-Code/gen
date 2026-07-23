import { ArrowRight, Check, Search, ShieldCheck, Sparkles, Target, Workflow } from "lucide-react";
import { AgentActivityStack } from "../components/agent-activity-stack";
import { ProductInputSwitcher } from "../components/product-input-switcher";
import { ThemeToggle } from "../components/motion/theme-toggle";

const agents = [
  ["01", "Lead researcher", "Maps your market and verifies every reachable decision-maker."],
  ["02", "Sequence planner", "Builds the right channel mix and timing for each lead."],
  ["03", "Email writer", "Creates a five-touch sequence with human, role-aware copy."],
  ["04", "SMS writer", "Crafts concise follow-ups that stay inside every character limit."],
  ["05", "Reply analyst", "Reads intent, spots opportunity and recommends the next move."],
  ["06", "Orchestrator", "Keeps every specialist aligned, honest and campaign-ready."],
];

const outcomes = [
  ["Verified", "Contact data backed by live research and source confidence."],
  ["Personal", "Messaging shaped around role, company and real buying signals."],
  ["Controlled", "Nothing is labeled sent until a real provider confirms it."],
];

export default function HomePage() {
  return (
    <main>
      <nav className="nav-shell" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="VranceFlex home">
          <span className="brand-mark">VF</span>
          <span>VranceFlex</span>
        </a>
        <div className="nav-links">
          <a href="#agents">Agents</a>
          <a href="#workflow">Workflow</a>
          <a href="#trust">Trust</a>
          <a href="/sign-in">Sign in</a>
        </div>
        <div className="nav-actions">
          <ThemeToggle
            variant="rectangle"
            start="bottom-up"
            className="theme-toggle"
            iconClassName="theme-toggle-icon"
          />
          <a className="nav-cta" href="/campaigns/new">
            Start a campaign <ArrowRight size={15} />
          </a>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={14} /> The agentic GTM workforce</div>
          <h1>Turn an idea into a market worth pursuing.</h1>
          <p className="hero-lede">
            Start with a website or simply explain the product in your head. VranceFlex coordinates six
            specialist agents to shape the market, find verified buyers and prepare outreach that feels
            researched—not automated.
          </p>
          <ProductInputSwitcher />
          <div className="hero-proof">
            <span><Check size={15} /> Source-backed research</span>
            <span><Check size={15} /> Human approval built in</span>
            <span><Check size={15} /> No stale lead lists</span>
          </div>
        </div>

        <div className="hero-console-wrap" aria-label="Live VranceFlex campaign activity">
          <div className="console-glow" />
          <div className="hero-console">
            <div className="console-head">
              <div>
                <span className="console-kicker">ACTIVE CAMPAIGN</span>
                <strong>Northstar / Europe</strong>
              </div>
              <span className="live-pill"><i /> Live</span>
            </div>
            <div className="console-stats">
              <div><span>Target</span><strong>25 leads</strong></div>
              <div><span>Confidence</span><strong>High</strong></div>
              <div><span>Stage</span><strong>Enriching</strong></div>
            </div>
            <div className="stack-label"><span>Agent activity</span><span>hover to inspect</span></div>
            <AgentActivityStack />
            <div className="console-foot">
              <span><ShieldCheck size={15} /> Approval required before outreach</span>
              <span>06 agents online</span>
            </div>
          </div>
        </div>
      </section>

      <section className="signal-strip" aria-label="Product outcomes">
        {outcomes.map(([title, text]) => (
          <article key={title}>
            <span>{title}</span>
            <p>{text}</p>
          </article>
        ))}
      </section>

      <section className="section-shell agents-section" id="agents">
        <div className="section-heading">
          <span className="section-label">THE TEAM</span>
          <h2>Six sharp specialists.<br />One revenue motion.</h2>
          <p>Each agent owns one job, receives only the context it needs and hands clean work to the next specialist.</p>
        </div>
        <div className="agent-grid">
          {agents.map(([number, title, description], index) => (
            <article className="agent-card" key={number}>
              <div className="agent-card-top">
                <span>{number}</span>
                {index === 0 ? <Search size={18} /> : index === 5 ? <Workflow size={18} /> : <Target size={18} />}
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="workflow-section" id="workflow">
        <div className="workflow-intro">
          <span className="section-label light">THE WORKFLOW</span>
          <h2>From signal to a campaign your team can trust.</h2>
          <p>The system moves deliberately. Every step makes the next one more relevant—and nothing goes out without the right approval.</p>
        </div>
        <div className="workflow-steps">
          {[
            ["01", "Understand", "We study the offer, market and strongest buying signals."],
            ["02", "Discover", "Live research finds the right companies and people."],
            ["03", "Prepare", "Every channel gets context-rich, lead-specific messaging."],
            ["04", "Review", "You inspect, approve and keep full control of the campaign."],
          ].map(([number, title, text]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="trust-section section-shell" id="trust">
        <div className="trust-card">
          <div className="trust-copy">
            <span className="section-label">BUILT FOR TRUST</span>
            <h2>Automation without the black box.</h2>
            <p>VranceFlex keeps research evidence, campaign state and human decisions visible from the first lead to the final reply.</p>
          </div>
          <ul>
            <li><ShieldCheck size={20} /><div><strong>Proof over promises</strong><span>Lead data carries sources and confidence.</span></div></li>
            <li><Check size={20} /><div><strong>Approval before action</strong><span>Generated, approved and sent are always distinct.</span></div></li>
            <li><Target size={20} /><div><strong>Respect every signal</strong><span>Replies and unsubscribe requests stop future outreach.</span></div></li>
          </ul>
        </div>
      </section>

      <section className="final-cta" id="start">
        <span className="section-label light">EARLY ACCESS</span>
        <h2>Your next campaign should begin with context.</h2>
        <p>Bring a URL—or the product idea you have not launched yet. VranceFlex will build the research, people and message strategy around it.</p>
        <a className="button-light" href="/campaigns/new">Build your campaign <ArrowRight size={18} /></a>
      </section>

      <footer>
        <a className="brand footer-brand" href="#top"><span className="brand-mark">VF</span><span>VranceFlex</span></a>
        <p>Agent-led prospecting, with people in control.</p>
        <span>© 2026 VranceFlex</span>
      </footer>
    </main>
  );
}
