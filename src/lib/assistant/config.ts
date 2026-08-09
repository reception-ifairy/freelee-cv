import 'server-only';
import { cache } from 'react';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { personas, personaVersions } from '@/db/schema';
import type { PersonaCapabilities } from '@/db/schema';
import { getSettingBool, getSettingInt, getSettingString } from '@/lib/settings';

/**
 * The site assistant is **a persona**, not a parallel chatbot.
 *
 * A setting names its slug; everything about how it behaves — model, tone,
 * personality traits, tools, guardrails, capabilities, chat layout, moderation,
 * voice — is edited at `/admin/personas/<id>` like any other persona. That is
 * the whole point: a second implementation would have to re-earn all of it and
 * would drift from the real one within a release.
 *
 * `cache()` deduplicates within a request, the same way `getSettings()` does —
 * the chat route asks whether a chat belongs to the assistant on every message.
 */

export const DEFAULT_ASSISTANT_GUEST_MESSAGES = 10;

export type SiteAssistant = {
  personaId: number;
  slug: string;
  name: string;
  avatar: string | null;
  accentColor: string;
  initials: string;
  tagline: string | null;
  welcome: string | null;
  suggestions: string[];
  capabilities: PersonaCapabilities;
  chatLayout: string | null;
  audienceType: string | null;
  audienceSegments: string[];
  label: string;
  guestMessages: number;
};

/**
 * Resolves the configured assistant, or `null` when there is nothing to show.
 *
 * Returns null — rather than throwing or falling back to some other persona —
 * when the feature is off, no slug is set, the slug does not match, the persona
 * is inactive, or it has no published version. A misconfigured assistant should
 * be *absent*, never a broken bubble on every page of the public site.
 */
export const getSiteAssistant = cache(async (): Promise<SiteAssistant | null> => {
  if (!(await getSettingBool('site_assistant_enabled'))) return null;

  const slug = (await getSettingString('site_assistant_persona')).trim();
  if (!slug) return null;

  const [row] = await db
    .select({ persona: personas, version: personaVersions })
    .from(personas)
    .leftJoin(personaVersions, eq(personaVersions.id, personas.currentVersionId))
    .where(and(eq(personas.slug, slug), eq(personas.isActive, true)))
    .limit(1);

  if (!row?.version) return null;

  const { persona, version } = row;

  return {
    personaId: persona.id,
    slug: persona.slug,
    name: persona.name,
    avatar: persona.avatar,
    accentColor: persona.accentColor,
    initials: persona.name.slice(0, 2).toUpperCase(),
    tagline: persona.tagline,
    welcome: version.welcomeMessage,
    suggestions: Array.isArray(version.suggestions) ? version.suggestions : [],
    capabilities: version.capabilities ?? {},
    chatLayout: version.chatLayout,
    audienceType: version.audienceType,
    audienceSegments: Array.isArray(version.audienceSegments) ? version.audienceSegments : [],
    label: (await getSettingString('site_assistant_label')).trim() || 'Ask us anything',
    guestMessages: (await getSettingInt('site_assistant_guest_messages', DEFAULT_ASSISTANT_GUEST_MESSAGES)) || DEFAULT_ASSISTANT_GUEST_MESSAGES,
  };
});

/**
 * Whether a chat belongs to the site assistant — and therefore runs free.
 *
 * Derived on the **server** from the configured slug and the chat's own
 * `personaId`. It deliberately takes no input from the client: a request-body
 * flag would let anyone chat to any paid persona for nothing by setting it.
 */
export async function isAssistantPersona(personaId: number | null | undefined): Promise<boolean> {
  if (personaId == null) return false;
  const assistant = await getSiteAssistant();
  return assistant?.personaId === personaId;
}
