import { listenToConversation } from '@/modules/group-chat/realtime';
import { assertParticipant } from '@/modules/group-chat/actions';
import { currentUser } from '@/lib/auth';

// A long-lived connection (LISTEN stays open) — needs the Node runtime, not
// the edge, same reason src/app/api/chat/route.ts does.
export const runtime = 'nodejs';

/**
 * Server-Sent Events endpoint for one room. Each connection opens its own
 * dedicated Postgres LISTEN (src/modules/group-chat/realtime.ts) — closed
 * when the client disconnects (`request.signal` abort), never left dangling.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: conversationId } = await params;

  const user = await currentUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  try {
    await assertParticipant(conversationId, user.id);
  } catch {
    return new Response('Forbidden', { status: 403 });
  }

  const encoder = new TextEncoder();
  let close: () => Promise<void>;

  const stream = new ReadableStream({
    start(controller) {
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'));
      }, 25_000);

      const listener = listenToConversation(conversationId, (payload) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      });
      close = async () => {
        clearInterval(heartbeat);
        await listener.close();
      };

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        void listener.close();
        controller.close();
      });
    },
    cancel() {
      void close?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
