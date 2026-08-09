import 'server-only';
import { randomUUID } from 'node:crypto';
import type { MessageAttachment } from '@/db/schema';
import { LocalDiskStore } from './local-store';
import { S3Store, s3ConfigFromEnv } from './s3-store';
import { extensionFor, MAX_IMAGE_BYTES, type FetchedObject, type MediaStore } from './types';

export { MAX_IMAGE_BYTES } from './types';

/**
 * Where uploaded and generated images live.
 *
 * Driver-based so the storage backend is a one-line change rather than a
 * refactor. `MEDIA_STORE=s3` switches to any S3-compatible bucket (AWS, R2,
 * MinIO, B2); anything else uses local disk.
 *
 * **Local disk is the default and is right for this deployment** — a single
 * box behind pm2. It stops being right the moment there's a second instance
 * or an ephemeral filesystem, because instance A cannot serve a file instance
 * B wrote. That's the actual trigger for switching, not disk size.
 *
 * Every caller goes through this module rather than touching `fs`, which is
 * what makes the swap contained.
 */
let cached: MediaStore | null = null;

export function mediaStore(): MediaStore {
  if (cached) return cached;

  if (process.env.MEDIA_STORE === 's3') {
    const config = s3ConfigFromEnv();
    if (!config) {
      // Loud, because silently writing to local disk on a multi-instance
      // deployment produces images that work on one box and 404 on the next —
      // an intermittent failure that's miserable to diagnose.
      throw new Error(
        'MEDIA_STORE=s3 but S3 is not fully configured. Need S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT.',
      );
    }
    cached = new S3Store(config);
  } else {
    cached = new LocalDiskStore();
  }

  return cached;
}

/**
 * Decodes a `data:` URL and stores it, returning the attachment record.
 *
 * Rejects rather than throws on anything unexpected: an upload that can't be
 * stored must not take down the chat turn it arrived with.
 */
export async function storeDataUrl(dataUrl: string, kind: MessageAttachment['kind']): Promise<MessageAttachment | null> {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) return null;

  const [, mediaType, base64] = match;
  const extension = extensionFor(mediaType);
  if (!extension) return null;

  const bytes = Buffer.from(base64, 'base64');
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) return null;

  try {
    const stored = await mediaStore().put(`${randomUUID()}.${extension}`, bytes, mediaType);
    return { url: stored.url, mediaType: stored.mediaType, kind };
  } catch {
    return null;
  }
}

/** Same, for a provider that hands back raw base64 with no data: prefix. */
export async function storeBase64(base64: string, mediaType: string, kind: MessageAttachment['kind']) {
  return storeDataUrl(`data:${mediaType};base64,${base64}`, kind);
}

/** Used by the /uploads route to stream an object back. */
export async function fetchStored(name: string): Promise<FetchedObject | null> {
  return mediaStore().get(name);
}
