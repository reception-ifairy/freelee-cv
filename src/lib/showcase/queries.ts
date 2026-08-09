import 'server-only';
import { and, asc, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { chats, messages, personas, showcaseItems } from '@/db/schema';

/**
 * Showcase reads.
 *
 * Deliberately **not** in `server/actions/admin-showcase.ts`: in a `'use server'`
 * file every export becomes a callable endpoint, so a query living there is a
 * public API whether or not it checks anything. `listPromotableMessages`
 * returns customer message content and generated images — exactly the sort of
 * thing that must not be reachable by invoking an action name.
 */

export type PromotableMessage = {
  id: string;
  imageUrl: string;
  mediaType: string;
  personaName: string | null;
  prompt: string | null;
  createdAt: Date;
};

/** Assistant replies carrying a generated image, newest first — the promotion candidates. */
export async function listPromotableMessages(limit = 40): Promise<PromotableMessage[]> {
  const rows = await db
    .select({
      id: messages.id,
      attachments: messages.attachments,
      chatId: messages.chatId,
      position: messages.position,
      createdAt: messages.createdAt,
      personaName: personas.name,
    })
    .from(messages)
    .leftJoin(chats, eq(chats.id, messages.chatId))
    .leftJoin(personas, eq(personas.id, chats.personaId))
    .where(
      and(
        eq(messages.role, 'assistant'),
        isNotNull(messages.attachments),
        sql`${messages.attachments}::text like '%generated%'`,
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  return rows.flatMap((row) => {
    const image = (row.attachments ?? []).find((a) => a.kind === 'generated');
    if (!image) return [];
    return [{
      id: row.id,
      imageUrl: image.url,
      mediaType: image.mediaType,
      personaName: row.personaName,
      prompt: null,
      createdAt: row.createdAt,
    }];
  });
}

/** Visible showcase items for the public block, optionally narrowed to one persona. */
export async function listShowcase({ limit = 12, personaId }: { limit?: number; personaId?: number } = {}) {
  const where = personaId
    ? and(eq(showcaseItems.isVisible, true), eq(showcaseItems.personaId, personaId))
    : eq(showcaseItems.isVisible, true);

  return db
    .select({
      id: showcaseItems.id,
      title: showcaseItems.title,
      caption: showcaseItems.caption,
      mediaUrl: showcaseItems.mediaUrl,
      prompt: showcaseItems.prompt,
      showPrompt: showcaseItems.showPrompt,
      personaName: personas.name,
      personaSlug: personas.slug,
      accentColor: personas.accentColor,
    })
    .from(showcaseItems)
    .leftJoin(personas, eq(personas.id, showcaseItems.personaId))
    .where(where)
    .orderBy(asc(showcaseItems.position), asc(showcaseItems.id))
    .limit(Math.min(Math.max(limit, 1), 48));
}
