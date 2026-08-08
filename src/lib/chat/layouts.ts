/**
 * Chat UI layouts — the chat window is the human↔AI interface, and a KS2
 * pupil, a compliance officer, a novelist and a dev team in a room do not
 * want the same one.
 *
 * **Thirteen configs, one engine.** Building a bespoke component tree per
 * category (20 of them) would be unmaintainable; a single layout for
 * everything is what we had, and it served none of them well. These cluster
 * the real needs instead, and every one of them is a *config* consumed by
 * the same components.
 *
 * No `@/db` import (plain data + pure functions) so client components and
 * the admin form can both read it — same split as `src/lib/ai/provider-ids.ts`.
 */

export const CHAT_LAYOUT_KEYS = [
  // Solo — one human, one persona.
  'default',
  'learning',
  'professional',
  'studio',
  'technical',
  'supportive',
  'quick_help',
  // Group — a room with several humans and/or personas.
  'roundtable',
  'workshop',
  'briefing',
  // Narrative — the reply itself is structured prose, not an answer.
  'narrative',
  'screenplay',
  'gamebook',
] as const;

export type ChatLayoutKey = (typeof CHAT_LAYOUT_KEYS)[number];

export function isChatLayoutKey(value: string): value is ChatLayoutKey {
  return (CHAT_LAYOUT_KEYS as readonly string[]).includes(value);
}

/** Which surface a layout is meant for. `both` = usable solo or in a room. */
export type ChatSurface = 'solo' | 'group' | 'both';

/**
 * Narrative layouts change the **output**, not just the frame: the model is
 * told to emit a specific structure, and the renderer parses and styles it.
 * Doing only one half would be worse than doing neither — prompting for a
 * structure nothing renders is invisible, and rendering a structure nothing
 * produces is dead code.
 */
export type NarrativeStyle = 'prose' | 'screenplay' | 'gamebook';

export type ChatLayoutConfig = {
  key: ChatLayoutKey;
  label: string;
  /** One line, shown under the label in the admin picker. */
  description: string;
  surface: ChatSurface;
  /** Vertical rhythm and font size of the transcript. */
  density: 'compact' | 'comfortable' | 'spacious';
  /** `bubble` = chat bubbles; `flat` = speaker-labelled rows (rooms); `document` = full-width prose, no bubble. */
  bubbleStyle: 'bubble' | 'flat' | 'document';
  /** How prominent the suggestion chips are. `hidden` still respects a persona that has none. */
  suggestionStyle: 'chips' | 'large' | 'minimal' | 'hidden';
  /** Per-message copy button (also gated by the persona's `copy` capability). */
  showCopy: boolean;
  /** Syntax-highlight code blocks. Costs a dynamic import, so only where it earns it. */
  codeHighlighting: boolean;
  /** Render a persona's guardrail response as a distinct callout instead of a plain paragraph. */
  highlightGuardrails: boolean;
  /** Tailwind classes for the assistant bubble/row accent. */
  accentClass: string;
  /** Composer placeholder, `{name}` replaced with the persona's name. */
  placeholder: string;
  narrative?: NarrativeStyle;
};

/**
 * The output contract each narrative style asks the model for. Appended to
 * the system prompt by `narrativePromptFragment()`; parsed back by
 * `src/lib/chat/narrative.ts`. Keep the two in step — the parser is written
 * against exactly these rules.
 */
const NARRATIVE_PROMPT: Record<NarrativeStyle, string> = {
  prose:
    'Write every reply as narrative prose, using this exact format:\n' +
    '- Narration and description: ordinary paragraphs.\n' +
    '- A character speaking: begin the line with the character\'s name in bold, then a colon, then their words. Example: **Mira:** We should turn back.\n' +
    '- Physical action or a stage direction: a line wrapped in single asterisks. Example: *She reaches for the lantern.*\n' +
    'Never break character to explain the format.',
  screenplay:
    'Write every reply in screenplay format, using this exact structure:\n' +
    '- Scene heading: a line in capitals beginning INT. or EXT. Example: INT. LIGHTHOUSE - NIGHT\n' +
    '- Action: ordinary paragraphs, present tense.\n' +
    '- Character cue: the character\'s name in bold, alone on its line. Example: **MIRA**\n' +
    '- Dialogue: the line immediately following a character cue.\n' +
    '- Parenthetical: a line wrapped in single asterisks. Example: *(quietly)*\n' +
    'Never break character to explain the format.',
  gamebook:
    'Write every reply as second-person interactive fiction, using this exact format:\n' +
    '- Narration: ordinary paragraphs addressed to "you".\n' +
    '- A character speaking: the character\'s name in bold, then a colon, then their words. Example: **Mira:** We should turn back.\n' +
    '- End every reply with two to four numbered choices, one per line, each beginning with a number and a close parenthesis. Example: 1) Open the door.\n' +
    'The choices must be genuinely different actions. Never break character to explain the format.',
};

/** Appended to the system prompt for narrative layouts. Empty for every other layout. */
export function narrativePromptFragment(layout: ChatLayoutKey): string {
  const style = CHAT_LAYOUTS[layout]?.narrative;
  return style ? `\n\n## Output format\n${NARRATIVE_PROMPT[style]}` : '';
}

export const CHAT_LAYOUTS: Record<ChatLayoutKey, ChatLayoutConfig> = {
  default: {
    key: 'default',
    label: 'Standard',
    description: 'The general-purpose chat window. Balanced for any topic.',
    surface: 'both',
    density: 'comfortable',
    bubbleStyle: 'bubble',
    suggestionStyle: 'chips',
    showCopy: true,
    codeHighlighting: false,
    highlightGuardrails: false,
    accentClass: 'border-slate-200 dark:border-slate-800',
    placeholder: 'Message {name}…',
  },

  learning: {
    key: 'learning',
    label: 'Learning',
    description: 'For school-age learners: large tappable prompts, roomy text, read-aloud.',
    surface: 'solo',
    density: 'spacious',
    bubbleStyle: 'bubble',
    suggestionStyle: 'large',
    showCopy: false, // a copy button is noise for a child; read-aloud is the useful affordance
    codeHighlighting: false,
    highlightGuardrails: true,
    accentClass: 'border-sky-200 bg-sky-50/50 dark:border-sky-900/60 dark:bg-sky-500/5',
    placeholder: 'Ask {name} anything…',
  },

  professional: {
    key: 'professional',
    label: 'Professional',
    description: 'Dense and quotable, for legal, finance, HR and technical advisory work.',
    surface: 'solo',
    density: 'compact',
    bubbleStyle: 'document',
    suggestionStyle: 'minimal',
    showCopy: true,
    codeHighlighting: false,
    highlightGuardrails: true,
    accentClass: 'border-slate-200 dark:border-slate-800',
    placeholder: 'Ask {name} a question…',
  },

  studio: {
    key: 'studio',
    label: 'Studio',
    description: 'Spacious reading column for drafting and long-form creative work.',
    surface: 'solo',
    density: 'spacious',
    bubbleStyle: 'document',
    suggestionStyle: 'chips',
    showCopy: true,
    codeHighlighting: false,
    highlightGuardrails: false,
    accentClass: 'border-amber-200/70 dark:border-amber-900/50',
    placeholder: 'What are we writing with {name}?',
  },

  technical: {
    key: 'technical',
    label: 'Technical',
    description: 'Syntax-highlighted code, minimal chrome, low suggestion clutter.',
    surface: 'both',
    density: 'compact',
    bubbleStyle: 'document',
    suggestionStyle: 'minimal',
    showCopy: true,
    codeHighlighting: true,
    highlightGuardrails: false,
    accentClass: 'border-slate-200 dark:border-slate-800',
    placeholder: 'Ask {name} — code, errors, architecture…',
  },

  supportive: {
    key: 'supportive',
    label: 'Supportive',
    description: 'Calm palette and gentle pacing for wellbeing and health topics.',
    surface: 'solo',
    density: 'spacious',
    bubbleStyle: 'bubble',
    suggestionStyle: 'minimal',
    showCopy: false,
    codeHighlighting: false,
    highlightGuardrails: true, // the whole point here — a crisis referral must be impossible to miss
    accentClass: 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-500/5',
    placeholder: 'Take your time — what would you like to talk about?',
  },

  quick_help: {
    key: 'quick_help',
    label: 'Quick help',
    description: 'Fast, short, tappable — support desks, bookings, FAQs.',
    surface: 'both',
    density: 'compact',
    bubbleStyle: 'bubble',
    suggestionStyle: 'large',
    showCopy: true,
    codeHighlighting: false,
    highlightGuardrails: false,
    accentClass: 'border-slate-200 dark:border-slate-800',
    placeholder: 'How can {name} help?',
  },

  roundtable: {
    key: 'roundtable',
    label: 'Roundtable',
    description: 'Every participant equal — speaker-labelled rows, easy @mentions.',
    surface: 'group',
    density: 'comfortable',
    bubbleStyle: 'flat',
    suggestionStyle: 'minimal',
    showCopy: true,
    codeHighlighting: false,
    highlightGuardrails: false,
    accentClass: 'border-slate-200 dark:border-slate-800',
    placeholder: 'Say something, or @mention someone…',
  },

  workshop: {
    key: 'workshop',
    label: 'Workshop',
    description: 'Idea-capture pacing for brainstorms — roomy rows, prominent prompts.',
    surface: 'group',
    density: 'spacious',
    bubbleStyle: 'flat',
    suggestionStyle: 'large',
    showCopy: true,
    codeHighlighting: false,
    highlightGuardrails: false,
    accentClass: 'border-violet-200/70 dark:border-violet-900/50',
    placeholder: 'Add an idea, or @mention someone to build on it…',
  },

  briefing: {
    key: 'briefing',
    label: 'Briefing',
    description: 'Compact, status-oriented rows for stand-ups and structured updates.',
    surface: 'group',
    density: 'compact',
    bubbleStyle: 'flat',
    suggestionStyle: 'hidden',
    showCopy: true,
    codeHighlighting: true,
    highlightGuardrails: false,
    accentClass: 'border-slate-200 dark:border-slate-800',
    placeholder: 'Post an update, or @mention someone…',
  },

  narrative: {
    key: 'narrative',
    label: 'Narrative',
    description: 'Story prose — narration, named dialogue and action beats, styled distinctly.',
    surface: 'both',
    density: 'spacious',
    bubbleStyle: 'document',
    suggestionStyle: 'minimal',
    showCopy: true,
    codeHighlighting: false,
    highlightGuardrails: false,
    accentClass: 'border-amber-200/60 dark:border-amber-900/40',
    placeholder: 'What happens next?',
    narrative: 'prose',
  },

  screenplay: {
    key: 'screenplay',
    label: 'Screenplay',
    description: 'Scene headings, character cues, dialogue and parentheticals in script format.',
    surface: 'both',
    density: 'comfortable',
    bubbleStyle: 'document',
    suggestionStyle: 'hidden',
    showCopy: true,
    codeHighlighting: false,
    highlightGuardrails: false,
    accentClass: 'border-slate-300 dark:border-slate-700',
    placeholder: 'Describe the next scene…',
    narrative: 'screenplay',
  },

  gamebook: {
    key: 'gamebook',
    label: 'Gamebook',
    description: 'Second-person interactive fiction — each reply ends in numbered choices you can tap.',
    surface: 'both',
    density: 'spacious',
    bubbleStyle: 'document',
    suggestionStyle: 'hidden', // the numbered choices *are* the suggestions here
    showCopy: false,
    codeHighlighting: false,
    highlightGuardrails: true,
    accentClass: 'border-indigo-200/70 dark:border-indigo-900/50',
    placeholder: 'What do you do?',
    narrative: 'gamebook',
  },
};

export function resolveChatLayout(value: string | null | undefined): ChatLayoutConfig {
  return value && isChatLayoutKey(value) ? CHAT_LAYOUTS[value] : CHAT_LAYOUTS.default;
}

export function layoutsForSurface(surface: 'solo' | 'group'): ChatLayoutConfig[] {
  return CHAT_LAYOUT_KEYS.map((k) => CHAT_LAYOUTS[k]).filter(
    (l) => l.surface === 'both' || l.surface === surface,
  );
}

/* ------------------------------------------------------------------------ *
 * Suggesting a layout from data the taxonomy already carries
 * ------------------------------------------------------------------------ */

/** Category slugs → layout. Uses the real UK-taxonomy slugs (20 live categories). */
const CATEGORY_LAYOUT: Record<string, ChatLayoutKey> = {
  'education-and-training': 'learning',

  'legal-and-compliance': 'professional',
  'business-and-finance': 'professional',
  'human-resources-and-career-development': 'professional',
  'engineering-and-architecture': 'professional',
  'science-and-research': 'professional',
  'environment-and-sustainability': 'professional',

  'writing-and-content-creation': 'studio',
  'creative-arts-and-design': 'studio',
  'marketing-and-advertising': 'studio',
  'digital-marketing': 'studio',

  'technology-and-web-development': 'technical',
  'emerging-technologies': 'technical',

  'lifestyle-and-wellness': 'supportive',
  'health-and-medicine': 'supportive',

  'travel-and-hospitality': 'quick_help',
  'sales-and-customer-support': 'quick_help',
  'virtual-assistance': 'quick_help',
  'translation-and-localisation': 'quick_help',

  'entertainment-and-media': 'narrative',
};

export type LayoutSignals = {
  categorySlugs?: string[];
  audienceType?: string | null;
  audienceSegments?: string[];
  /** `categories.narrativePotential` / `sectors.narrativeFit` — 'low' | 'medium' | 'high' | 'very_high'. */
  narrativeFit?: string | null;
  /** `sectors.primaryInteractionModes` — FAQ / COACH / AGENT / ANALYST / NARRATOR. */
  interactionModes?: string[];
};

/**
 * Computes a **default suggestion**, never a silent override — the resolved
 * value is written to `persona_versions.chat_layout` where an admin can see
 * and change it. Ordered most-specific first: a `B2C-CYP-*` audience segment
 * (a school key stage) beats its category, because an Education persona
 * aimed at teachers is not the same UI problem as one aimed at a Year 4 class.
 */
export function suggestLayoutForPersona(signals: LayoutSignals): ChatLayoutKey {
  const { categorySlugs = [], audienceType, audienceSegments = [], narrativeFit, interactionModes = [] } = signals;

  // 1. A child audience is the strongest signal there is — a Year 4 pupil
  //    needs the learning interface whatever the subject happens to be.
  if (audienceSegments.some((code) => code.startsWith('B2C-CYP-'))) return 'learning';

  // 2. The category mapping, which is the reliable signal.
  //
  //    This sits ABOVE the interaction-mode and narrative-fit rules below,
  //    and that ordering is load-bearing. The first version had it last, and
  //    testing against the real taxonomy produced nonsense: Education →
  //    narrative, Legal → quick help, Health → quick help. The cause is that
  //    `interactionModes` arrives aggregated across every sector in a
  //    category, and a 5-sector category almost always contains *some*
  //    NARRATOR or FAQ sector — so those rules fired for nearly all 20
  //    categories and overrode the mapping that was actually correct.
  for (const slug of categorySlugs) {
    const mapped = CATEGORY_LAYOUT[slug];
    if (mapped) return mapped;
  }

  // 3. Only for a persona whose category has no mapping do the finer-grained
  //    taxonomy signals get a say. They are genuinely meaningful per *sector*
  //    — they're just not safe to read once they've been flattened to a whole
  //    category (see above).
  if (interactionModes.includes('NARRATOR')) return 'narrative';
  if (interactionModes.includes('FAQ')) return 'quick_help';
  if (narrativeFit === 'very_high') return 'narrative';

  // 4. Nothing categorised at all: B2B/B2G work is professional by default; B2C isn't.
  if (audienceType === 'B2B' || audienceType === 'B2G') return 'professional';

  return 'default';
}
