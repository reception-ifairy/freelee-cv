import 'server-only';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

/**
 * Realtime via Postgres LISTEN/NOTIFY + Server-Sent Events — not a hosted
 * pub/sub (Pusher/Ably) or a self-hosted WebSocket server. Zero new hosted
 * dependency, fits this app's pm2/long-running-process deploy model. See
 * docs/13-group-chat.md for the tradeoff (no true low-latency presence/
 * typing indicators — a documented fast-follow, not built here).
 */
type NotifyPayload = { type: 'message.created'; messageId: string };

function channelFor(conversationId: string): string {
  // Postgres channel identifiers aren't parameterisable in NOTIFY/LISTEN,
  // and conversation ids are server-generated uuids (crypto.randomUUID()),
  // never user input — safe to interpolate directly.
  return `conversation_${conversationId.replace(/-/g, '_')}`;
}

/** Any pooled connection can NOTIFY — unlike LISTEN, it doesn't need a dedicated one. */
export async function notifyConversation(conversationId: string, payload: NotifyPayload): Promise<void> {
  await db.execute(sql`select pg_notify(${channelFor(conversationId)}, ${JSON.stringify(payload)})`);
}

/**
 * Opens a **dedicated** connection for the lifetime of one SSE stream — the
 * pooled `db` client (src/db/index.ts) is sized for short-lived queries and
 * must never be tied up holding a LISTEN open. Call `close()` when the
 * client disconnects (the route handler's `request.signal` abort), or the
 * connection leaks.
 */
export function listenToConversation(
  conversationId: string,
  onMessage: (payload: NotifyPayload) => void,
): { close: () => Promise<void> } {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set.');

  const listener = postgres(connectionString, { max: 1 });

  listener.listen(channelFor(conversationId), (raw) => {
    try {
      onMessage(JSON.parse(raw) as NotifyPayload);
    } catch (error) {
      console.error('[group-chat] malformed realtime payload', error);
    }
  });

  return { close: () => listener.end({ timeout: 1 }) };
}
