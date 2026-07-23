import type { ProcessFlowDefinition } from '@/components/process-flow/types';

/** Generic product workflow — context-first, used on How It Works and similar pages. */
export const AMROGEN_PRODUCT_WORKFLOW: ProcessFlowDefinition = {
  id: 'amrogen-product-workflow',
  ariaLabel:
    'AmroGen workflow: company context to research, personalised sequences, quality review, and Resend delivery',
  steps: [
    {
      id: 'context',
      label: 'Bring your context',
      sub: 'URL · contacts · import',
      icon: 'globe',
      detail:
        'Start from a target account, contacts you already know, or an imported list. The coordinator adapts the pipeline to what you provide.',
    },
    {
      id: 'research',
      label: 'Research & qualify',
      bullets: ['Roles · fit context', 'Email-ready contacts'],
      icon: 'users',
      detail:
        'Specialist agents research the account or ingest your contacts, returning relevant people, roles, fit context, and email-ready data.',
    },
    {
      id: 'sequences',
      label: 'Personalise & refine',
      bullets: ['Quality scoring', 'Retry weak drafts'],
      accent: true,
      icon: 'sparkles',
      detail:
        'Email sequences are written per lead, scored by the Orchestrator, and retried when output falls below the quality bar — before you review.',
    },
    {
      id: 'resend',
      label: 'Approve & deliver',
      bullets: ['Human approval', 'Resend delivery'],
      highlight: 'You stay in control',
      icon: 'mail',
      detail:
        'You approve what goes out. Approved email steps send through your connected or platform Resend account only.',
    },
  ],
};

/** AmroGen outreach workflow — JSON flow (no raster/SVG diagram artwork). */
export const AMROGEN_OUTREACH_FLOW: ProcessFlowDefinition = {
  id: 'amrogen-outreach',
  ariaLabel:
    'AmroGen workflow: company URL to verified decision-makers, reviewed AI sequences, approve and send through Resend',
  steps: [
    {
      id: 'url',
      label: 'Enter a company URL',
      sub: 'No list upload required',
      icon: 'globe',
      detail:
        'Start from a target account, competitor customer, or sponsor site. Manual entry and CSV import are also supported.',
    },
    {
      id: 'leads',
      label: 'Find verified decision-makers',
      bullets: ['Roles · fit context', 'Email-ready contacts'],
      icon: 'users',
      detail:
        'The coordinator researches the account and returns relevant people, roles, fit context, and email-ready contact data (MVP cap applies).',
    },
    {
      id: 'sequences',
      label: 'Review AI-written sequences',
      bullets: ['Quality scoring', 'Retry weak drafts'],
      accent: true,
      icon: 'sparkles',
      detail:
        'Email sequences are generated per lead, scored for quality, and retried when the draft is weak — you review before anything sends.',
    },
    {
      id: 'resend',
      label: 'Approve and send through Resend',
      bullets: ['Human approval', 'Resend delivery'],
      highlight: 'You stay in control',
      icon: 'mail',
      detail:
        'You approve what goes out. Approved email steps send through your connected or platform Resend account only.',
    },
  ],
};

export const AMROGEN_DEVELOPER_FLOW: ProcessFlowDefinition = {
  id: 'amrogen-developer',
  ariaLabel: 'AmroGen API and MCP workflow: trigger campaigns programmatically, monitor pipeline events, approve outreach',
  steps: [
    {
      id: 'api',
      label: 'REST API',
      sub: 'Auth · credits',
      icon: 'plug',
      detail: 'Create and manage campaigns via REST endpoints with API keys and credit-based usage.',
    },
    {
      id: 'mcp',
      label: 'MCP access',
      sub: 'Agent tools',
      icon: 'cog',
      detail: 'Connect AmroGen to agent workflows through MCP for programmatic campaign orchestration.',
    },
    {
      id: 'pipeline',
      label: 'Pipeline events',
      bullets: ['Lead research', 'Sequence gen'],
      accent: true,
      icon: 'sparkles',
      detail: 'Monitor coordinator-led research and sequence generation through pipeline status APIs.',
    },
    {
      id: 'approve',
      label: 'Approve & send',
      sub: 'Resend-ready',
      icon: 'shield-check',
      detail: 'Human approval remains required before Resend delivers approved email steps.',
    },
  ],
};
