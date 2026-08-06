'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Subscribes to /api/rooms/[id]/stream and refreshes the server-rendered
 * message list on every `message.created` event. Simpler than diffing/
 * appending messages client-side — this room UI isn't optimistic or
 * token-streamed (see docs/13-group-chat.md), so a full RSC refresh on each
 * new message is proportionate, not wasteful.
 */
export function RoomLive({ conversationId }: { conversationId: string }) {
  const router = useRouter();

  useEffect(() => {
    const source = new EventSource(`/api/rooms/${conversationId}/stream`);
    source.onmessage = () => router.refresh();
    source.onerror = () => {
      // EventSource auto-reconnects on transient errors; nothing to do here.
    };
    return () => source.close();
  }, [conversationId, router]);

  return null;
}
