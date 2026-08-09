import 'server-only';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { MessageAttachment } from '@/db/schema';

/**
 * Where uploaded and generated images live.
 *
 * **Not `public/`**, which is the obvious choice and the wrong one: Next
 * builds its static-file manifest when the server starts, so a file written
 * to `public/` afterwards returns 404 until the process restarts. Verified
 * directly — an upload 404'd, a `pm2 restart` with no other change made the
 * same URL return 200. That makes `public/` unusable for anything users
 * create at runtime.
 *
 * These live outside it and are served by `src/app/uploads/[name]/route.ts`,
 * which reads from disk per request. The public URL is unchanged
 * (`/uploads/<name>`), so nothing else had to know.
 *
 * **The deliberate limitation**: this is local disk. Right for a single box
 * behind pm2, which is exactly this deployment; wrong the moment there's a
 * second instance or an ephemeral filesystem. Swapping it for object storage
 * means changing this file and the route — that's why every caller goes
 * through here rather than touching `fs` directly.
 */
export const UPLOAD_DIR = path.join(process.cwd(), 'storage', 'uploads');

/** Only formats every current model actually accepts. */
const ALLOWED: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function isAllowedImageType(mediaType: string): boolean {
  return mediaType in ALLOWED;
}

/**
 * Decodes a `data:` URL and writes it to disk, returning the public path.
 *
 * Rejects rather than throws on anything unexpected: an upload that can't be
 * stored must not take down the chat turn it arrived with.
 */
export async function storeDataUrl(dataUrl: string, kind: MessageAttachment['kind']): Promise<MessageAttachment | null> {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) return null;

  const [, mediaType, base64] = match;
  if (!isAllowedImageType(mediaType)) return null;

  const bytes = Buffer.from(base64, 'base64');
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) return null;

  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const name = `${randomUUID()}.${ALLOWED[mediaType]}`;
    await writeFile(path.join(UPLOAD_DIR, name), bytes);
    return { url: `/uploads/${name}`, mediaType, kind };
  } catch {
    return null;
  }
}

/** Same, for a provider that hands back raw base64 with no data: prefix. */
export async function storeBase64(base64: string, mediaType: string, kind: MessageAttachment['kind']) {
  return storeDataUrl(`data:${mediaType};base64,${base64}`, kind);
}
