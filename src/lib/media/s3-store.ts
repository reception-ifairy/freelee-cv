import { signRequest } from './sigv4';
import { CONTENT_TYPE_BY_EXT, isValidObjectName, type FetchedObject, type MediaStore, type StoredObject } from './types';

export type S3Config = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Full origin, e.g. `https://s3.eu-west-2.amazonaws.com` or an R2/MinIO endpoint. */
  endpoint: string;
  /** Optional CDN/base origin for public reads. Falls back to serving through this app. */
  publicBaseUrl?: string;
  /** Path-style (`/bucket/key`) is what R2 and MinIO want; AWS accepts it too. */
  forcePathStyle?: boolean;
};

/**
 * Any S3-compatible object store — AWS S3, Cloudflare R2, MinIO, Backblaze B2.
 *
 * Two plain HTTP calls signed with SigV4 rather than `@aws-sdk/client-s3`,
 * which is tens of megabytes of dependency for `PUT` and `GET`. The signing is
 * isolated in `./sigv4.ts` and checked against AWS's published test vector
 * (`npx tsx scripts/verify-sigv4.ts`).
 *
 * **Honest status**: the signing algorithm is verified and the request shape is
 * exercised by `scripts/verify-s3-store.ts` against a local mock, but this has
 * **not** been run against a real bucket — there are no credentials on this
 * deployment to try. Do one smoke test (`MEDIA_STORE=s3`, upload an image,
 * reload the page) before trusting it with anything that matters.
 */
export class S3Store implements MediaStore {
  readonly name = 's3';

  constructor(private readonly config: S3Config) {}

  private target(name: string): { url: string; host: string; path: string } {
    const endpoint = new URL(this.config.endpoint);
    const pathStyle = this.config.forcePathStyle ?? true;

    if (pathStyle) {
      const path = `/${this.config.bucket}/${name}`;
      return { url: `${endpoint.origin}${path}`, host: endpoint.host, path };
    }

    const host = `${this.config.bucket}.${endpoint.host}`;
    return { url: `${endpoint.protocol}//${host}/${name}`, host, path: `/${name}` };
  }

  async put(name: string, bytes: Uint8Array, mediaType: string): Promise<StoredObject> {
    const { url, host, path } = this.target(name);

    const { headers } = signRequest({
      method: 'PUT',
      path,
      host,
      region: this.config.region,
      service: 's3',
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      headers: { 'content-type': mediaType },
      payload: bytes,
    });

    const response = await fetch(url, { method: 'PUT', headers, body: bytes as BodyInit });
    if (!response.ok) throw new Error(`S3 PUT failed: HTTP ${response.status}`);

    // A public bucket or CDN can serve reads directly; otherwise they come
    // back through this app's own /uploads route, which keeps the URL shape
    // identical to the local driver either way.
    return {
      url: this.config.publicBaseUrl ? `${this.config.publicBaseUrl.replace(/\/$/, '')}/${name}` : `/uploads/${name}`,
      mediaType,
    };
  }

  async get(name: string): Promise<FetchedObject | null> {
    if (!isValidObjectName(name)) return null;
    const { url, host, path } = this.target(name);

    const { headers } = signRequest({
      method: 'GET',
      path,
      host,
      region: this.config.region,
      service: 's3',
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      payload: '',
    });

    const response = await fetch(url, { headers });
    if (!response.ok || !response.body) return null;

    const size = Number(response.headers.get('content-length'));
    return {
      body: response.body,
      mediaType:
        response.headers.get('content-type') ??
        CONTENT_TYPE_BY_EXT[name.split('.').pop() ?? ''] ??
        'application/octet-stream',
      size: Number.isFinite(size) ? size : undefined,
    };
  }
}

/** Reads S3 config from the environment. Returns null when it isn't fully configured. */
export function s3ConfigFromEnv(): S3Config | null {
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const endpoint = process.env.S3_ENDPOINT;
  if (!bucket || !accessKeyId || !secretAccessKey || !endpoint) return null;

  return {
    bucket,
    accessKeyId,
    secretAccessKey,
    endpoint,
    region: process.env.S3_REGION ?? 'auto',
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  };
}
