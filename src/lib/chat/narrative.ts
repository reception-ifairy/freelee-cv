import type { NarrativeStyle } from './layouts';

/**
 * Parses the output format that `narrativePromptFragment()` asks the model
 * for, so narration, dialogue, action and choices can be styled distinctly
 * instead of arriving as one undifferentiated wall of markdown.
 *
 * **Fail-open by construction**: anything the parser doesn't recognise
 * becomes a `narration` block and renders as ordinary prose. A model that
 * ignores the format instruction produces a plain, readable reply — never an
 * error, never a blank message. That matters because the format is a request
 * to a language model, not a guarantee.
 */
export type NarrativeBlock =
  | { type: 'narration'; text: string }
  | { type: 'dialogue'; speaker: string; text: string }
  | { type: 'direction'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'choice'; index: number; text: string };

/**
 * A speech line, in the two shapes models actually produce:
 *   `**Mira:** We should turn back.`   ← colon inside the bold (what we ask for)
 *   `**Mira**: We should turn back.`   ← colon outside (constant drift)
 *
 * The colon is **required** in both, and the speaker is capped at 48 chars.
 * Without those constraints an ordinary emphasised sentence —
 * `**Important** note here` — parses as dialogue spoken by "Important".
 *
 * The first version of this only handled the colon-outside form, so it
 * missed every line the prompt actually asks for and silently rendered all
 * dialogue as narration. Caught by the parser test, not by review.
 */
const DIALOGUE_INSIDE_RE = /^\*\*\s*([^*\n]{1,48}?)\s*:\s*\*\*\s*(.+)$/;
const DIALOGUE_OUTSIDE_RE = /^\*\*\s*([^*\n]{1,48}?)\s*\*\*\s*:\s*(.+)$/;

function matchDialogue(line: string): { speaker: string; text: string } | null {
  const m = line.match(DIALOGUE_INSIDE_RE) ?? line.match(DIALOGUE_OUTSIDE_RE);
  return m ? { speaker: m[1].trim(), text: m[2].trim() } : null;
}
/** `**MIRA**` alone on a line — a screenplay character cue. */
const CUE_RE = /^\*\*(.+?)\*\*\s*$/;
/** A whole line wrapped in single asterisks: `*She reaches for the lantern.*` */
const DIRECTION_RE = /^\*([^*].*?)\*$/;
/** `INT. LIGHTHOUSE - NIGHT` */
const SCENE_RE = /^(INT\.|EXT\.|INT\/EXT\.)\s*(.+)$/;
/** `1) Open the door.` — also tolerates `1.` and `1 -`, which models drift to. */
const CHOICE_RE = /^(\d{1,2})\s*[).\-]\s+(.+)$/;

export function parseNarrative(text: string, style: NarrativeStyle): NarrativeBlock[] {
  const lines = text.split('\n');
  const blocks: NarrativeBlock[] = [];
  let pendingCue: string | null = null;
  let narration: string[] = [];

  const flushNarration = () => {
    const joined = narration.join('\n').trim();
    if (joined) blocks.push({ type: 'narration', text: joined });
    narration = [];
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      // A blank line ends a paragraph but not a pending screenplay cue —
      // the format puts the cue and its dialogue on consecutive lines, and
      // models routinely separate them with a blank one anyway.
      flushNarration();
      continue;
    }

    // A screenplay cue is "armed": the next non-empty line is its dialogue.
    if (pendingCue) {
      const speaker: string = pendingCue;
      pendingCue = null;
      const direction = line.match(DIRECTION_RE);
      if (direction) {
        // A parenthetical between the cue and the line — keep the cue armed.
        blocks.push({ type: 'direction', text: direction[1].trim() });
        pendingCue = speaker;
        continue;
      }
      blocks.push({ type: 'dialogue', speaker, text: line });
      continue;
    }

    if (style === 'gamebook') {
      const choice = line.match(CHOICE_RE);
      if (choice) {
        flushNarration();
        blocks.push({ type: 'choice', index: Number(choice[1]), text: choice[2].trim() });
        continue;
      }
    }

    if (style === 'screenplay') {
      const scene = line.match(SCENE_RE);
      if (scene) {
        flushNarration();
        blocks.push({ type: 'heading', text: line });
        continue;
      }
      const cue = line.match(CUE_RE);
      if (cue) {
        flushNarration();
        pendingCue = cue[1].trim();
        continue;
      }
    }

    const dialogue = matchDialogue(line);
    if (dialogue) {
      flushNarration();
      blocks.push({ type: 'dialogue', ...dialogue });
      continue;
    }

    const direction = line.match(DIRECTION_RE);
    if (direction) {
      flushNarration();
      blocks.push({ type: 'direction', text: direction[1].trim() });
      continue;
    }

    narration.push(raw);
  }

  // A cue with nothing after it (a truncated stream) still shows the name
  // rather than vanishing — mid-stream renders shouldn't drop content.
  if (pendingCue) blocks.push({ type: 'dialogue', speaker: pendingCue, text: '' });
  flushNarration();

  return blocks;
}

/** The tappable choices at the end of a gamebook reply, for the composer to offer. */
export function choicesOf(blocks: NarrativeBlock[]): string[] {
  return blocks.filter((b): b is Extract<NarrativeBlock, { type: 'choice' }> => b.type === 'choice').map((b) => b.text);
}
