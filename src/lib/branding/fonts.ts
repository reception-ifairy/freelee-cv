/**
 * Curated font choices, not a full Google Fonts integration — same "fixed
 * small set" trade-off as knowledge-source dot-paths and how-it-works step
 * icons. Each stack is either a system stack (zero network cost) or the
 * variable Inter font already loaded in the root layout.
 */
export const FONT_KEYS = ['inter', 'system', 'georgia', 'space-grotesk', 'jetbrains-mono'] as const;
export type FontKey = (typeof FONT_KEYS)[number];

export const FONT_LABELS: Record<FontKey, string> = {
  inter: 'Inter (default)',
  system: 'System UI',
  georgia: 'Georgia (serif)',
  'space-grotesk': 'Space Grotesk',
  'jetbrains-mono': 'JetBrains Mono',
};

const FONT_STACKS: Record<FontKey, string> = {
  inter: "'InterVariable', ui-sans-serif, system-ui, sans-serif",
  system: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
  georgia: "Georgia, 'Times New Roman', serif",
  'space-grotesk': "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
  'jetbrains-mono': "'JetBrains Mono', ui-monospace, monospace",
};

export function isFontKey(value: string): value is FontKey {
  return (FONT_KEYS as readonly string[]).includes(value);
}

export function fontStack(key: string | null | undefined): string | null {
  if (!key || !isFontKey(key)) return null;
  return FONT_STACKS[key];
}
