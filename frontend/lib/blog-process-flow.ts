import { AMROGEN_DEVELOPER_FLOW, AMROGEN_OUTREACH_FLOW } from '@/content/landing-process-flows';
import { renderProcessFlowHtml } from '@/components/process-flow/render-html';
import type { ProcessFlowDefinition, ProcessFlowStep } from '@/components/process-flow/types';

const WORKFLOW_IMAGE_RE =
  /workflow|pipeline|onboarding|enrichment|mcp|api-vs|versus|compared|step-run|sending-vs|waterfall|feature\.png$/i;

export function isWorkflowDiagramImage(alt: string, src: string): boolean {
  const haystack = `${alt} ${src}`.toLowerCase();
  return WORKFLOW_IMAGE_RE.test(haystack);
}

function splitComparison(alt: string): [string, string] | null {
  const versus = alt.match(/(.+?)\s+(?:versus|vs\.?|compared with)\s+(.+?)(?:\s+for|\s+visual|$)/i);
  if (versus) return [versus[1].trim(), versus[2].trim()];
  return null;
}

function stepsFromHeading(heading: string): ProcessFlowStep[] {
  const comparison = splitComparison(heading);
  if (comparison) {
    return [
      { id: 'a', label: comparison[0], icon: 'layout-dashboard' },
      { id: 'b', label: comparison[1], accent: true, icon: 'sparkles' },
    ];
  }
  if (/mcp|api|developer|agent/i.test(heading)) {
    return AMROGEN_DEVELOPER_FLOW.steps;
  }
  return AMROGEN_OUTREACH_FLOW.steps;
}

function flowFromAlt(alt: string, src: string): ProcessFlowDefinition {
  if (/mcp|api-vs|rest api/i.test(`${alt} ${src}`)) {
    return {
      ...AMROGEN_DEVELOPER_FLOW,
      ariaLabel: alt || AMROGEN_DEVELOPER_FLOW.ariaLabel,
    };
  }

  const comparison = splitComparison(alt);
  if (comparison) {
    return {
      id: `compare-${comparison[0].slice(0, 12).replace(/\s+/g, '-')}`,
      ariaLabel: alt || 'Comparison workflow',
      steps: [
        { id: 'left', label: comparison[0], icon: 'layout-dashboard' },
        { id: 'right', label: comparison[1], accent: true, icon: 'sparkles' },
      ],
    };
  }

  if (/feature image|ai sdr|cold email|outreach/i.test(alt)) {
    return { ...AMROGEN_OUTREACH_FLOW, ariaLabel: alt || AMROGEN_OUTREACH_FLOW.ariaLabel };
  }

  const sectionMatch = alt.match(/explaining (.+)$/i) || alt.match(/for (.+)$/i);
  const heading = sectionMatch?.[1] || alt.replace(/^[^:]+:\s*/, '').trim() || 'AmroGen workflow';

  return {
    id: 'blog-section-flow',
    ariaLabel: alt || 'AmroGen process workflow',
    steps: stepsFromHeading(heading),
  };
}

export function workflowImageToHtml(alt: string, src: string): string {
  return renderProcessFlowHtml(flowFromAlt(alt, src));
}

export function processFlowMarkerToHtml(marker: string): string | null {
  const normalized = marker.trim().toLowerCase();
  if (normalized === 'outreach' || normalized === 'amrogen-outreach') {
    return renderProcessFlowHtml(AMROGEN_OUTREACH_FLOW);
  }
  if (normalized === 'developer' || normalized === 'amrogen-developer' || normalized === 'mcp') {
    return renderProcessFlowHtml(AMROGEN_DEVELOPER_FLOW);
  }
  return null;
}
