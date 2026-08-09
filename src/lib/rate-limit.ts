/**
 * A small fixed-window rate limiter.
 *
 * **Not marked `server-only`**, deliberately: it uses no server APIs, and the
 * guard would only stop `scripts/verify-rate-limit.ts` from testing it. The
 * thing to actually avoid is importing it *into a client component* — the
 * counter would then live per browser and silently enforce nothing. It is only
 * ever imported from route handlers and server actions.
 *
 * **Why this exists now**: the site assistant is a free, unauthenticated LLM
 * reachable from every public page. Without a limiter that is an open invitation
 * to burn the account's API quota — one script, one afternoon. Nothing else in
 * this codebase had any rate limiting at all before this.
 *
 * **In-memory, deliberately.** This app runs as a single pm2 process, so a
 * module-level Map is accurate and costs nothing. It is *not* correct across
 * multiple instances: each would keep its own counters and the effective limit
 * would multiply. If a second instance is ever added this needs to move to
 * Postgres or Redis — written down here rather than discovered later, the same
 * way `storage/uploads` was flagged before it became object storage.
 *
 * Fixed window rather than a sliding one: at these limits the burst allowed at
 * a window boundary is irrelevant, and the whole thing stays one Map lookup.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Stops the Map growing without bound on a long-lived process. */
function sweep(now: number) {
  if (buckets.size < 5_000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  /** Requests left in the current window. */
  remaining: number;
  /** Seconds until the window resets — suitable for a Retry-After header. */
  retryAfter: number;
};

export function checkRateLimit({
  name,
  key,
  limit,
  windowMs,
}: {
  /** Namespace, so two features cannot share a bucket by accident. */
  name: string;
  /** Guest token, user id, or IP — whatever identifies the caller. */
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const id = `${name}:${key}`;
  const existing = buckets.get(id);

  if (!existing || existing.resetAt <= now) {
    buckets.set(id, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  existing.count += 1;
  const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

  if (existing.count > limit) return { ok: false, remaining: 0, retryAfter };
  return { ok: true, remaining: limit - existing.count, retryAfter };
}

/**
 * Best-effort caller identity from a request.
 *
 * An IP behind a proxy is only as trustworthy as the proxy — `x-forwarded-for`
 * is caller-supplied and can be spoofed. It is therefore the **fallback**, used
 * when there is no guest cookie or session to key on, and the limits that rely
 * on it are set generously enough that a false positive is unlikely to hurt a
 * real visitor sharing an office NAT.
 */
export function callerIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

/** Test seam — resets every bucket. Never called in application code. */
export function __resetRateLimits() {
  buckets.clear();
}
