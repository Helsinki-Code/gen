import type { LucideIcon } from 'lucide-react';

/** Lucide icon keys for JSON-driven process flow steps (all Amro products). */
export type ProcessFlowStepIcon =
  | 'log-in'
  | 'library'
  | 'play'
  | 'mic'
  | 'map'
  | 'sparkles'
  | 'cog'
  | 'mail'
  | 'users'
  | 'award'
  | 'building'
  | 'globe'
  | 'credit-card'
  | 'settings'
  | 'layout-dashboard'
  | 'file-search'
  | 'image'
  | 'shield-check'
  | 'file-down'
  | 'webhook'
  | 'plug';

export type ProcessFlowStep = {
  id: string;
  label: string;
  sub?: string;
  bullets?: string[];
  highlight?: string;
  detail?: string;
  accent?: boolean;
  icon?: ProcessFlowStepIcon;
};

export type ProcessFlowDefinition = {
  id: string;
  ariaLabel: string;
  steps: ProcessFlowStep[];
};

export type ProcessFlowIconMap = Record<ProcessFlowStepIcon, LucideIcon>;
