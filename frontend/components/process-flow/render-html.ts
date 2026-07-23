import type { ProcessFlowDefinition } from './types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Static HTML process flow for articles, email, and export (no SVG artwork). */
export function renderProcessFlowHtml(flow: ProcessFlowDefinition): string {
  const steps = flow.steps
    .map((step, index) => {
      const bullets =
        step.bullets && step.bullets.length > 0
          ? `<ul class="apf-bullets">${step.bullets
              .map((line) => `<li>${escapeHtml(line)}</li>`)
              .join('')}</ul>`
          : step.sub
            ? `<p class="apf-sub">${escapeHtml(step.sub)}</p>`
            : '';
      const highlight = step.highlight
        ? `<p class="apf-highlight">${escapeHtml(step.highlight)}</p>`
        : '';
      const detail = step.detail ? `<p class="apf-detail">${escapeHtml(step.detail)}</p>` : '';
      const accent = step.accent ? ' apf-step--accent' : '';

      return `<article class="apf-step${accent}">
  <span class="apf-num">${index + 1}</span>
  <div class="apf-body">
    <h4 class="apf-label">${escapeHtml(step.label)}</h4>
    ${bullets}
    ${highlight}
    ${detail}
  </div>
</article>`;
    })
    .join('');

  return `<figure class="article-process-flow" role="img" aria-label="${escapeHtml(flow.ariaLabel)}">
  <div class="apf-grid">${steps}</div>
</figure>`;
}
