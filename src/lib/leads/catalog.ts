/**
 * The assistant's conversational tools.
 *
 * Plain module — the chat hub (client) renders these and the server validates
 * against them, so a tool cannot exist in one place and not the other.
 *
 * Adapted from BotVerse's InteractiveToolCards. Each one is a tiny form that
 * appears inside the chat rather than sending someone to a separate page,
 * which is the whole point: the moment somebody is interested is the moment to
 * ask, not three clicks later.
 */

export type LeadFieldKey = 'name' | 'email' | 'phone' | 'note';

export type LeadTool = {
  kind: string;
  label: string;
  blurb: string;
  /** Curated icon key, resolved by BlockIcon. */
  icon: string;
  cta: string;
  /** Shown after a successful submission. */
  done: string;
  fields: { key: LeadFieldKey; label: string; type: 'text' | 'email' | 'tel' | 'textarea'; required?: boolean }[];
};

export const LEAD_TOOLS: LeadTool[] = [
  {
    kind: 'free_trial',
    label: 'Claim a free trial',
    blurb: 'Credits to try every persona',
    icon: 'gift',
    cta: 'Claim it',
    done: 'Claimed. Check your email for the details.',
    fields: [
      { key: 'name', label: 'Your name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
    ],
  },
  {
    kind: 'callback',
    label: 'Request a callback',
    blurb: 'A person will ring you',
    icon: 'phone',
    cta: 'Request it',
    done: 'Got it. We will call you back.',
    fields: [
      { key: 'name', label: 'Your name', type: 'text', required: true },
      { key: 'phone', label: 'Phone number', type: 'tel', required: true },
      { key: 'note', label: 'Best time to call', type: 'text' },
    ],
  },
  {
    kind: 'subscribe',
    label: 'Get updates',
    blurb: 'New personas and releases',
    icon: 'mail',
    cta: 'Subscribe',
    done: 'Subscribed. No more than one email a week.',
    fields: [{ key: 'email', label: 'Email', type: 'email', required: true }],
  },
  {
    kind: 'info_pack',
    label: 'Send me the details',
    blurb: 'What it does and what it costs',
    icon: 'star',
    cta: 'Send it',
    done: 'On its way to your inbox.',
    fields: [
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'note', label: 'What are you trying to solve?', type: 'textarea' },
    ],
  },
  {
    kind: 'discount',
    label: 'Ask about pricing',
    blurb: 'Volume and non-profit rates',
    icon: 'chart',
    cta: 'Ask',
    done: 'Thanks — we will come back to you with numbers.',
    fields: [
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'note', label: 'Roughly how much would you use?', type: 'textarea' },
    ],
  },
];

export function leadTool(kind: string): LeadTool | undefined {
  return LEAD_TOOLS.find((tool) => tool.kind === kind);
}

export const LEAD_KIND_LABELS: Record<string, string> = Object.fromEntries(
  LEAD_TOOLS.map((tool) => [tool.kind, tool.label]),
);

export const LEAD_STATUSES = ['new', 'contacted', 'closed'] as const;
