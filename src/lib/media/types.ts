/**
 * The storage contract, kept in its own file with no `server-only` guard so
 * both drivers and their tests can import it.
 *
 * Two operations, deliberately: `put` and `get`. Nothing else is needed —
 * images are written once, read many times, and never modified. Adding
 * `delete`/`list` before anything wants them would be inventing an interface
 * against imagined requirements.
 */
export type StoredObject = {
  /** Site-relative, always `/uploads/<name>` regardless of driver. */
  url: string;
  mediaType: string;
};

export type FetchedObject = {
  body: ReadableStream | Uint8Array;
  mediaType: string;
  size?: number;
};

export interface MediaStore {
  readonly name: string;
  /** Persists bytes under `name` and returns the public URL for them. */
  put(name: string, bytes: Uint8Array, mediaType: string): Promise<StoredObject>;
  /** Reads an object back, or null when it isn't there. */
  get(name: string): Promise<FetchedObject | null>;
}

/** Only formats every current model actually accepts. */
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function extensionFor(mediaType: string): string | null {
  return ALLOWED_IMAGE_TYPES[mediaType] ?? null;
}

/**
 * Names are always `<uuid>.<ext>` because we generate them. Validating the
 * *shape* — rather than sanitising an arbitrary string — is what makes path
 * traversal impossible in the local driver: `..` and `/` cannot match.
 */
export const OBJECT_NAME_RE = /^[a-f0-9-]{36}\.(png|jpg|webp|gif)$/;

export function isValidObjectName(name: string): boolean {
  return OBJECT_NAME_RE.test(name);
}

export const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};
