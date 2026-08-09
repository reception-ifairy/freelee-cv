import 'server-only';
import { getSettingString } from '@/lib/settings';
import { classifyInput } from './ai-filter';

/**
 * Input filtering for personas with `capabilities.badwordFilter` ticked.
 *
 * **Be clear about what this is.** It is a word-list matcher with light
 * normalisation, not a moderation service. It catches lazy abuse — the kind
 * that makes a children's tutor produce something a parent screenshots — and
 * it will not catch a determined person. Anyone who needs real moderation
 * wants a provider moderation endpoint or a dedicated service, and should not
 * mistake this for one. It is documented that way in the handbook too, rather
 * than implying a guarantee it can't make.
 *
 * The trade-off it *does* make well: it runs before the model call, so a
 * blocked message costs nothing and never reaches the provider.
 */

/**
 * Deliberately short and uncontroversial — unambiguous slurs and sexual
 * profanity only. A long default list produces false positives ("Scunthorpe"),
 * and the terms an individual site cares about vary enough that the real list
 * belongs in settings, not in code.
 */
const DEFAULT_TERMS = [
  'fuck', 'shit', 'cunt', 'bitch', 'bastard', 'wanker', 'twat',
  'dick', 'prick', 'slut', 'whore', 'faggot', 'nigger', 'retard',
];

/**
 * Collapses the usual evasions before matching: case, accents, repeated
 * letters (`fuuuck`), separators (`f-u-c-k`, `f.u.c.k`) and digit/symbol
 * substitutions (`sh1t`, `@ss`).
 *
 * This is a trade-off, not a free win: aggressive normalisation is what makes
 * word-boundary matching survive contact with reality, and it's also what
 * creates false positives. Boundaries are still required (see `matches`), so
 * an innocent word that merely *contains* a term is not flagged.
 */
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '9': 'g', '@': 'a', $: 's' };

function normalise(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      // `!` and `|` are *not* mapped to `i` even though leetspeak uses them:
      // they're far more often ordinary punctuation, and mapping them turned
      // "WANKER!" into "wankeri", which then matched nothing at all.
      .replace(/[0134579@$]/g, (c) => LEET[c] ?? c)
      // Non-letters become a space rather than vanishing, so "f-u-c-k" and
      // "wanker!" both end up separable instead of fusing into a new word.
      .replace(/[^a-z\s]/g, ' ')
      // Re-join deliberately spaced-out letters: "f u c k" → "fuck". Requires
      // three or more single letters in a row, so ordinary prose is untouched.
      .replace(/\b(?:[a-z]\s+){2,}[a-z]\b/g, (m) => m.replace(/\s+/g, ''))
      // Collapse *all* repeats to one, not to two — "fuuuuck" → "fuck" only
      // works this way. Safe because no term in the list has a doubled letter,
      // and word boundaries still prevent "assessment" or "shiitake" matching.
      .replace(/([a-z])\1+/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function activeTerms(): Promise<string[]> {
  // Admin-supplied list replaces the default entirely rather than adding to
  // it — a site that wants to *allow* a default term has no way to remove it
  // otherwise, and "my list is the list" is easier to reason about.
  const custom = await getSettingString('badword_list', '');
  const parsed = custom
    .split(/[,\n]/)
    .map((t) => normalise(t).trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : DEFAULT_TERMS;
}

export type FilterResult = { blocked: false } | { blocked: true; term: string };

/**
 * The public entry point. `moderation_mode` picks the strategy:
 *
 *   `wordlist` (default) — the matcher below. Fast, free, shallow.
 *   `ai`                 — a classifier call, falling back to the word list
 *                          if the provider is unreachable or returns nonsense.
 *   `off`                — nothing, even for personas with the flag ticked.
 *
 * Defaults to `wordlist` so behaviour is unchanged until an admin opts in —
 * switching every persona to a paid, slower check without being asked would
 * be a surprising bill.
 */
export async function moderateInput(text: string): Promise<FilterResult> {
  const mode = await getSettingString('moderation_mode', 'wordlist');
  if (mode === 'off') return { blocked: false };

  if (mode === 'ai') {
    const verdict = await classifyInput(text);
    if (verdict.usable) {
      return verdict.blocked ? { blocked: true, term: verdict.category ?? 'flagged' } : { blocked: false };
    }
    // Classifier unavailable — fall through to the word list rather than
    // letting everything past.
  }

  return checkInput(text);
}

/**
 * Word-boundary matched against the normalised text, so `class` never trips
 * on a substring and `Scunthorpe` never trips on the town.
 */
export async function checkInput(text: string): Promise<FilterResult> {
  const haystack = ` ${normalise(text)} `;

  for (const term of await activeTerms()) {
    const pattern = new RegExp(`(?:^|\\s)${escapeRegex(term)}(?:\\s|$)`, 'i');
    if (pattern.test(haystack)) return { blocked: true, term };
  }

  return { blocked: false };
}
