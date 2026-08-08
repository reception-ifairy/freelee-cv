import type { Translator } from '@/lib/i18n/translate';

/**
 * The "?" help tips shown next to controls across the app.
 *
 * Deliberately split in two halves, because the two halves have different
 * lifecycles:
 *
 *  - **The text** (title + body) lives here as literal `t('help.…', 'English')`
 *    calls, so `scripts/extract-translations.ts` picks it up into the `help`
 *    word-bank module and it gets translated like every other string. A
 *    DB-stored help text would be invisible to the translation pipeline.
 *  - **The video** (`help_topics.video_url`, migration 0020) is DB data an
 *    admin fills in later — the instructional-video feature itself is not
 *    built this pass, only its schema and the render slot. A topic with no
 *    row, or a row with a null `video_url`, simply shows text only. That is
 *    the normal state today, not a broken one.
 */
export type HelpTopic = { key: string; title: string; body: string };

export function helpTopics(t: Translator): Record<string, HelpTopic> {
  const topic = (key: string, title: string, body: string): HelpTopic => ({ key, title, body });

  return {
    'home.sections': topic(
      'home.sections',
      t('help.home_sections_title', 'Home page sections'),
      t('help.home_sections_body', 'Every block on the home page can be reordered, hidden, or edited. Drag the arrows to change the order, or use the eye icon to hide a block without deleting it.'),
    ),
    'personas.browse': topic(
      'personas.browse',
      t('help.personas_browse_title', 'Finding the right persona'),
      t('help.personas_browse_body', 'Filter by category to narrow the list, or by audience if you need someone who speaks to businesses, consumers, or the public sector specifically.'),
    ),
    'personas.audience': topic(
      'personas.audience',
      t('help.personas_audience_title', 'Audience types'),
      t('help.personas_audience_body', 'B2B personas write for businesses and professionals, B2C for individual consumers, and B2G for government and public-sector work. It changes the tone and the examples they reach for.'),
    ),
    'pricing.credits': topic(
      'pricing.credits',
      t('help.pricing_credits_title', 'How credits work'),
      t('help.pricing_credits_body', 'Credits are deducted per message based on how much text is actually processed. Longer conversations and more capable models cost more. Nothing expires and there is no subscription.'),
    ),
    'chat.suggestions': topic(
      'chat.suggestions',
      t('help.chat_suggestions_title', 'Suggested replies'),
      t('help.chat_suggestions_body', 'These are starting points, not commands. Tap one to drop it into the message box, then edit it before sending if you want something different.'),
    ),
    'blog.reading': topic(
      'blog.reading',
      t('help.blog_reading_title', 'Reading time'),
      t('help.blog_reading_body', 'An estimate based on the length of the article, at roughly 200 words per minute.'),
    ),
    'translations.bank': topic(
      'translations.bank',
      t('help.translations_bank_title', 'The word bank'),
      t('help.translations_bank_body', 'Every piece of English text in the interface, grouped into modules. Add a language and the AI translates each module in turn, so a failure in one module never damages the rest.'),
    ),
    'translations.export': topic(
      'translations.export',
      t('help.translations_export_title', 'Exporting for a translator'),
      t('help.translations_export_body', 'The export puts English on the left and the target language on the right, one row per string, so a translator can work through it without touching the app.'),
    ),
  };
}

export const HELP_TOPIC_KEYS = [
  'home.sections',
  'personas.browse',
  'personas.audience',
  'pricing.credits',
  'chat.suggestions',
  'blog.reading',
  'translations.bank',
  'translations.export',
] as const;
