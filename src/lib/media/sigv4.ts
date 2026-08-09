import { createHash, createHmac } from 'node:crypto';

/**
 * Minimal AWS Signature V4, enough to PUT and GET an object.
 *
 * Hand-rolled rather than pulling in `@aws-sdk/client-s3`, which is tens of
 * megabytes for two HTTP calls. The trade-off is that the signing has to be
 * *right*, so it's isolated here and checked against AWS's own published test
 * vector (see scripts/verify-sigv4.ts) — the one part of object storage that
 * can be verified with no bucket and no credentials.
 */

export type SigV4Input = {
  method: string;
  /** Already-encoded path, e.g. `/bucket/key.png`. */
  path: string;
  host: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Extra headers to sign. `host` and `x-amz-*` are added automatically. */
  headers?: Record<string, string>;
  payload: Uint8Array | string;
  /** Overridable so tests can pin the timestamp AWS's vector uses. */
  now?: Date;
};

function sha256Hex(data: Uint8Array | string): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

/** `20150830T123600Z` and `20150830`. */
function stamps(now: Date): { amzDate: string; dateStamp: string } {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

export function signRequest(input: SigV4Input): { headers: Record<string, string>; signature: string } {
  const { amzDate, dateStamp } = stamps(input.now ?? new Date());
  const payloadHash = sha256Hex(input.payload);

  const headers: Record<string, string> = {
    ...input.headers,
    host: input.host,
    'x-amz-date': amzDate,
  };

  // S3 requires the payload hash as a signed header; the generic SigV4 flow
  // does not. Adding it unconditionally is what made this fail AWS's
  // `get-vanilla` vector — the algorithm was right, the header set wasn't.
  if (input.service === 's3') headers['x-amz-content-sha256'] = payloadHash;

  // Canonical headers must be lowercase, trimmed, and sorted by name.
  const sorted = Object.entries(headers)
    .map(([k, v]) => [k.toLowerCase(), String(v).trim().replace(/\s+/g, ' ')] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const signedHeaders = sorted.map(([k]) => k).join(';');
  const canonicalHeaders = `${sorted.map(([k, v]) => `${k}:${v}`).join('\n')}\n`;

  const canonicalRequest = [
    input.method.toUpperCase(),
    input.path,
    '', // query string — never used by these two calls
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${input.secretAccessKey}`, dateStamp), input.region), input.service),
    'aws4_request',
  );
  const signature = createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

  return {
    signature,
    headers: {
      ...headers,
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}
