'use client';

import { useId, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Award,
  Building2,
  ChevronDown,
  Cog,
  CreditCard,
  FileDown,
  FileSearch,
  Globe,
  Image as ImageIcon,
  LayoutDashboard,
  Library,
  LogIn,
  Mail,
  Map,
  Mic,
  Play,
  Plug,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Webhook,
} from 'lucide-react';
import { cn } from './cn';
import type { ProcessFlowDefinition, ProcessFlowIconMap, ProcessFlowStep } from './types';

const STEP_ICONS: ProcessFlowIconMap = {
  'log-in': LogIn,
  library: Library,
  play: Play,
  mic: Mic,
  map: Map,
  sparkles: Sparkles,
  cog: Cog,
  mail: Mail,
  users: Users,
  award: Award,
  building: Building2,
  globe: Globe,
  'credit-card': CreditCard,
  settings: Settings,
  'layout-dashboard': LayoutDashboard,
  'file-search': FileSearch,
  image: ImageIcon,
  'shield-check': ShieldCheck,
  'file-down': FileDown,
  webhook: Webhook,
  plug: Plug,
};

function FlowConnector({ direction }: { direction: 'vertical' | 'horizontal' }) {
  if (direction === 'vertical') {
    return (
      <div className="flex justify-center py-1" aria-hidden="true">
        <div className="flex flex-col items-center gap-0.5 text-primary">
          <span className="h-3 w-px bg-border" />
          <ArrowDown className="h-4 w-4" />
          <span className="h-3 w-px bg-border" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center px-1 sm:px-2" aria-hidden="true">
      <div className="flex items-center gap-0.5 text-primary">
        <span className="hidden h-px w-3 bg-border sm:block" />
        <ArrowRight className="h-5 w-5" />
        <span className="hidden h-px w-3 bg-border sm:block" />
      </div>
    </div>
  );
}

function gridClassForStepCount(count: number): string {
  if (count <= 2) return 'md:grid-cols-2';
  if (count === 3) return 'md:grid-cols-3';
  return 'md:grid-cols-2';
}

function ProcessFlowStepCard({
  step,
  stepNumber,
  expanded,
  onToggle,
}: {
  step: ProcessFlowStep;
  stepNumber: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = step.icon ? STEP_ICONS[step.icon] : null;
  const hasExpandable = Boolean(step.detail);
  const panelId = `process-flow-detail-${step.id}`;

  return (
    <article
      className={cn(
        'flex h-full min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow',
        step.accent ? 'border-primary ring-1 ring-primary/20' : 'border-border/60',
        expanded && 'shadow-md'
      )}
    >
      <button
        type="button"
        onClick={hasExpandable ? onToggle : undefined}
        disabled={!hasExpandable}
        aria-expanded={hasExpandable ? expanded : undefined}
        aria-controls={hasExpandable ? panelId : undefined}
        className={cn(
          'w-full rounded-xl p-4 text-left sm:p-5',
          hasExpandable &&
            'cursor-pointer hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          !hasExpandable && 'cursor-default'
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
              step.accent ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
            )}
          >
            {stepNumber}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                {Icon ? <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden /> : null}
                <h4 className="text-base font-semibold leading-snug text-foreground sm:text-lg">{step.label}</h4>
              </div>
              {hasExpandable ? (
                <ChevronDown
                  className={cn(
                    'h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200',
                    expanded && 'rotate-180'
                  )}
                  aria-hidden
                />
              ) : null}
            </div>
            {step.sub ? (
              <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground sm:text-base">
                {step.sub}
              </p>
            ) : null}
            {step.bullets && step.bullets.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {step.bullets.map((line) => (
                  <li key={line} className="break-words text-sm leading-relaxed text-muted-foreground">
                    {line}
                  </li>
                ))}
              </ul>
            ) : null}
            {step.highlight ? (
              <p className="mt-2 break-words text-sm font-medium text-primary">{step.highlight}</p>
            ) : null}
          </div>
        </div>
      </button>

      {hasExpandable && expanded ? (
        <div id={panelId} className="border-t border-border/60 bg-muted/10 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
          <p className="break-words pl-11 text-sm leading-relaxed text-foreground sm:text-base">
            {step.detail}
          </p>
        </div>
      ) : null}
    </article>
  );
}

export type ProcessFlowDiagramProps = {
  flow: ProcessFlowDefinition;
  testId?: string;
  className?: string;
};

/** JSON-driven process flow — HTML cards, Lucide icons, expandable steps. Mobile + desktop. */
export function ProcessFlowDiagram({ flow, testId, className }: ProcessFlowDiagramProps) {
  const listId = useId();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = (stepId: string) => {
    setExpandedId((current) => (current === stepId ? null : stepId));
  };

  const renderVerticalSteps = () => (
    <ol className="m-0 list-none space-y-0 p-0" aria-label={flow.ariaLabel}>
      {flow.steps.map((step, index) => (
        <li key={step.id} className="w-full">
          <ProcessFlowStepCard
            step={step}
            stepNumber={index + 1}
            expanded={expandedId === step.id}
            onToggle={() => toggle(step.id)}
          />
          {index < flow.steps.length - 1 ? <FlowConnector direction="vertical" /> : null}
        </li>
      ))}
    </ol>
  );

  const renderGridSteps = () => (
    <ol
      className={cn('m-0 grid list-none gap-4 p-0', gridClassForStepCount(flow.steps.length))}
      aria-label={flow.ariaLabel}
    >
      {flow.steps.map((step, index) => (
        <li key={step.id} className="flex min-w-0">
          <ProcessFlowStepCard
            step={step}
            stepNumber={index + 1}
            expanded={expandedId === step.id}
            onToggle={() => toggle(step.id)}
          />
        </li>
      ))}
    </ol>
  );

  return (
    <div className={className} data-testid={testId ?? flow.id} id={listId}>
      <p className="mb-3 text-xs text-muted-foreground md:hidden">Tap a step to expand details</p>
      <p className="mb-3 hidden text-xs text-muted-foreground md:block">Click a step to expand details</p>
      <div className="md:hidden">{renderVerticalSteps()}</div>
      <div className="hidden md:block">{renderGridSteps()}</div>
    </div>
  );
}
