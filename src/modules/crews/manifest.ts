import type { ModuleManifest } from '@/lib/modules/types';

export const manifest: ModuleManifest = {
  key: 'crews',
  name: 'Crews',
  version: '1.0.0',
  description:
    'Bot-to-bot orchestration — a crew of personas works a task together (sequential pipeline, ' +
    'parallel fan-out, or a supervisor persona that delegates) inside a pinned group-chat ' +
    'conversation, hard-capped by turns and a credit budget. See docs/14-crews.md.',
  type: 'feature',
  isCore: false,
  requires: { modules: ['group-chat', 'persona-versioning', 'billing-overhaul'] },
  provides: {
    capabilities: ['crews.sequential', 'crews.parallel', 'crews.supervisor'],
    events: ['crews.run.started', 'crews.run.completed'],
  },
  permissions: ['crews.crew.create', 'crews.crew.run', 'crews.crew.manage'],
  navigation: [{ label: 'Crews', href: '/crews', group: 'workspace', order: 21 }],
  settingsSchema: {
    defaultMaxTurns: {
      type: 'number', default: 6,
      description: 'Fallback max-turns for newly created crews when not set explicitly.',
    },
    defaultBudgetCredits: {
      type: 'number', default: 50,
      description: 'Fallback credit budget for newly created crews when not set explicitly.',
    },
  },
};
