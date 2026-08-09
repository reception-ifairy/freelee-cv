/**
 * The rate limiter guards a free, unauthenticated LLM, so it is worth testing
 * as logic rather than trusting one lucky live request.
 * Run with `npx tsx scripts/verify-rate-limit.ts`.
 */
import { checkRateLimit, __resetRateLimits } from '@/lib/rate-limit';

const checks: [string, boolean][] = [];
const check = (name: string, actual: unknown, expected: unknown) =>
  checks.push([name, JSON.stringify(actual) === JSON.stringify(expected)]);

__resetRateLimits();

// Allows exactly `limit`, then refuses.
const results = Array.from({ length: 6 }, () => checkRateLimit({ name: 't', key: 'a', limit: 5, windowMs: 60_000 }).ok);
check('allows exactly the limit', results, [true, true, true, true, true, false]);

// Keys are independent.
check('a different key is unaffected', checkRateLimit({ name: 't', key: 'b', limit: 5, windowMs: 60_000 }).ok, true);

// Namespaces are independent — two features cannot share a bucket.
check('a different namespace is unaffected', checkRateLimit({ name: 'other', key: 'a', limit: 5, windowMs: 60_000 }).ok, true);

// remaining counts down and floors at 0.
__resetRateLimits();
check('remaining counts down', [
  checkRateLimit({ name: 'r', key: 'a', limit: 3, windowMs: 60_000 }).remaining,
  checkRateLimit({ name: 'r', key: 'a', limit: 3, windowMs: 60_000 }).remaining,
  checkRateLimit({ name: 'r', key: 'a', limit: 3, windowMs: 60_000 }).remaining,
  checkRateLimit({ name: 'r', key: 'a', limit: 3, windowMs: 60_000 }).remaining,
], [2, 1, 0, 0]);

// retryAfter is a sane number of seconds once blocked.
__resetRateLimits();
checkRateLimit({ name: 'w', key: 'a', limit: 1, windowMs: 60_000 });
const blocked = checkRateLimit({ name: 'w', key: 'a', limit: 1, windowMs: 60_000 });
check('retryAfter is within the window', blocked.retryAfter > 0 && blocked.retryAfter <= 60, true);

// The window actually resets.
__resetRateLimits();
checkRateLimit({ name: 'x', key: 'a', limit: 1, windowMs: 1 });
await new Promise((resolve) => setTimeout(resolve, 15));
check('a new window allows again', checkRateLimit({ name: 'x', key: 'a', limit: 1, windowMs: 1 }).ok, true);

let pass = 0;
for (const [name, ok] of checks) {
  if (ok) pass++;
  console.log(ok ? 'ok  ' : 'FAIL', name);
}
console.log(`\n${pass}/${checks.length} passed`);
process.exit(pass === checks.length ? 0 : 1);
