'use client';

import type { UIMessage } from 'ai';
import { ChatWindow, type ChatCapabilities } from '@/components/chat/chat-window';

/**
 * Thin wrapper so the embed can reuse `ChatWindow` unchanged.
 *
 * The only difference an iframe needs is height: `ChatWindow` sizes itself
 * against the full site chrome (`h-[calc(100vh-9rem)]`), which leaves a dead
 * gap inside a widget that has none. This wrapper lets it fill the frame
 * instead — worth a tiny component to avoid threading a "context" prop
 * through the chat internals for one CSS rule.
 */
export function EmbedChat(props: {
  chatId: string;
  initialMessages: UIMessage[];
  suggestions: string[];
  personaName?: string;
  layoutKey?: string | null;
  capabilities?: ChatCapabilities;
}) {
  return (
    <div className="flex-1 overflow-hidden [&>section]:h-full [&>section]:rounded-none [&>section]:border-0 [&>section]:shadow-none">
      <ChatWindow {...props} />
    </div>
  );
}
