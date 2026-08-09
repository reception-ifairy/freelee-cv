import path from 'node:path';
import { fetchStored } from '@/lib/media/store';
import { CONTENT_TYPE_BY_EXT, isValidObjectName } from '@/lib/media/types';

export const runtime = 'nodejs';

/**
 * Serves user uploads and generated images, whichever storage driver is in
 * use (src/lib/media/store.ts).
 *
 * This route exists because `public/` cannot do the job: Next snapshots that
 * directory at server start, so a runtime-written file 404s until a restart
 * (verified, not assumed — see the local driver's comment).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!isValidObjectName(name)) return new Response('Not found', { status: 404 });

  const object = await fetchStored(name);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers({
    'Content-Type': object.mediaType || CONTENT_TYPE_BY_EXT[path.extname(name).slice(1)] || 'application/octet-stream',
    // Content-addressed by a random name: a given URL's bytes never change.
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
  if (object.size !== undefined) headers.set('Content-Length', String(object.size));

  const body = object.body instanceof Uint8Array ? new Blob([object.body as BlobPart]) : object.body;
  return new Response(body, { headers });
}
