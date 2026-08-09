/**
 * Checks src/lib/media/sigv4.ts against AWS's own published `get-vanilla`
 * test vector from the SigV4 test suite. This is the one part of object
 * storage that can be verified with no bucket and no credentials, so it is
 * verified rather than assumed.
 *
 *   npx tsx scripts/verify-sigv4.ts
 */
import { signRequest } from '../src/lib/media/sigv4';

const EXPECTED_SIGNATURE = '5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31';

const { signature } = signRequest({
  method: 'GET',
  path: '/',
  host: 'example.amazonaws.com',
  region: 'us-east-1',
  service: 'service',
  accessKeyId: 'AKIDEXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
  payload: '',
  now: new Date('2015-08-30T12:36:00Z'),
});

console.log('computed:', signature);
console.log('expected:', EXPECTED_SIGNATURE);
console.log(signature === EXPECTED_SIGNATURE ? '\n✓ SigV4 matches the AWS vector.' : '\n✗ MISMATCH');
process.exit(signature === EXPECTED_SIGNATURE ? 0 : 1);
