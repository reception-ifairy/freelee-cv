import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { CONTENT_TYPE_BY_EXT, isValidObjectName, type FetchedObject, type MediaStore, type StoredObject } from './types';

/**
 * Local disk. The default, and correct for a single box behind pm2 — which is
 * exactly this deployment.
 *
 * **Not `public/`**, which is the obvious choice and the wrong one: Next
 * builds its static-file manifest when the server starts, so a file written
 * there afterwards returns 404 until the process restarts. Verified directly —
 * an upload 404'd, a `pm2 restart` with no other change made the same URL
 * return 200. Files therefore live outside `public/` and are served by
 * `src/app/uploads/[name]/route.ts`.
 */
export class LocalDiskStore implements MediaStore {
  readonly name = 'local';

  constructor(private readonly dir: string = path.join(process.cwd(), 'storage', 'uploads')) {}

  async put(name: string, bytes: Uint8Array, mediaType: string): Promise<StoredObject> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(path.join(this.dir, name), bytes);
    return { url: `/uploads/${name}`, mediaType };
  }

  async get(name: string): Promise<FetchedObject | null> {
    if (!isValidObjectName(name)) return null;

    const filePath = path.join(this.dir, name);
    try {
      const info = await stat(filePath);
      if (!info.isFile()) return null;

      return {
        body: Readable.toWeb(createReadStream(filePath)) as ReadableStream,
        mediaType: CONTENT_TYPE_BY_EXT[path.extname(name).slice(1)] ?? 'application/octet-stream',
        size: info.size,
      };
    } catch {
      return null;
    }
  }
}
