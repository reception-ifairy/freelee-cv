/**
 * Exercises S3Store against a local mock endpoint.
 *
 * What this proves: the request shape is right — method, path-style URL,
 * content-type, an Authorization header with the expected credential scope
 * and signed-header list, and a byte-identical round trip.
 *
 * What this does NOT prove: that a real bucket accepts the signature. That
 * needs credentials this deployment doesn't have. The signing algorithm
 * itself is verified separately against AWS's own vector — see
 * scripts/verify-sigv4.ts.
 *
 *   npx tsx scripts/verify-s3-store.ts
 */
import { createServer } from 'node:http';
import { S3Store } from '../src/lib/media/s3-store';

const objects = new Map<string, { body: Buffer; contentType: string }>();
const seen: { method: string; url: string; auth: string; contentType?: string }[] = [];

const server = createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const key = req.url ?? '';
    seen.push({
      method: req.method ?? '',
      url: key,
      auth: String(req.headers.authorization ?? ''),
      contentType: req.headers['content-type'] as string | undefined,
    });

    if (req.method === 'PUT') {
      objects.set(key, { body: Buffer.concat(chunks), contentType: String(req.headers['content-type'] ?? '') });
      res.writeHead(200).end();
      return;
    }
    const found = objects.get(key);
    if (!found) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': found.contentType, 'content-length': String(found.body.length) });
    res.end(found.body);
  });
});

async function main() {
  await new Promise<void>((r) => server.listen(4599, '127.0.0.1', r));

  const store = new S3Store({
    bucket: 'test-bucket', region: 'eu-west-2',
    accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
    endpoint: 'http://127.0.0.1:4599', forcePathStyle: true,
  });

  const name = '11111111-2222-3333-4444-555555555555.png';
  const payload = Buffer.from('not-really-a-png-but-bytes-are-bytes');

  const put = await store.put(name, payload, 'image/png');
  const got = await store.get(name);
  const body = got ? Buffer.from(await new Response(got.body as ReadableStream).arrayBuffer()) : Buffer.alloc(0);

  const checks: [string, boolean][] = [
    ['PUT used path-style URL', seen[0]?.url === `/test-bucket/${name}`],
    ['PUT sent content-type', seen[0]?.contentType === 'image/png'],
    ['PUT signed with SigV4 + correct scope', /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/eu-west-2\/s3\/aws4_request/.test(seen[0]?.auth ?? '')],
    ['PUT signed x-amz-content-sha256', /SignedHeaders=[^,]*x-amz-content-sha256/.test(seen[0]?.auth ?? '')],
    ['put() returned an /uploads URL', put.url === `/uploads/${name}`],
    ['GET round-tripped identical bytes', body.equals(payload)],
    ['GET reported the media type', got?.mediaType === 'image/png'],
    ['invalid object name refused without a request', (await store.get('../../etc/passwd')) === null && seen.length === 2],
  ];

  let bad = 0;
  for (const [label, ok] of checks) { if (!ok) bad++; console.log(`${ok ? '✓' : '✗'} ${label}`); }
  console.log(bad === 0 ? '\nS3Store request shape verified against the mock.' : `\n${bad} check(s) failed.`);

  server.close();
  process.exit(bad === 0 ? 0 : 1);
}

main();
