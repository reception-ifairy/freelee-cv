import type { ModuleManifest } from '@/lib/modules/types';

export const manifest: ModuleManifest = {
  key: 'group-chat',
  name: 'Group Chat',
  version: '1.0.0',
  description:
    'Rooms with multiple people and multiple personas, @mentions route replies in parallel. ' +
    'A persona is a participant exactly like a human — one modeling choice, no separate code path. ' +
    'See docs/13-group-chat.md.',
  type: 'feature',
  isCore: false,
  requires: { modules: ['teams', 'persona-versioning', 'billing-overhaul'] },
  provides: {
    capabilities: ['conversation.multi_participant', 'conversation.mentions'],
    events: ['group-chat.room.created', 'group-chat.persona.mentioned'],
  },
  permissions: ['group-chat.room.create', 'group-chat.room.moderate', 'group-chat.persona.invite'],
  navigation: [{ label: 'Rooms', href: '/rooms', group: 'workspace', order: 20 }],
  settingsSchema: {
    maxPersonasPerRoom: {
      type: 'number', default: 5,
      description: 'Cap on how many personas can reply to one @all-personas mention.',
    },
  },
};
