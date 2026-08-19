# The job queue

Crew runs used to execute **inline, synchronously, inside the server action** — `startCrewRunAction`
awaited `executeCrewRun` before redirecting. That is why `crews.max_turns` defaults to 6: a whole
run had to finish inside one HTTP request.

It was the ceiling on everything bot teamwork could become, and it had a second cost that is easy to
miss. The realtime path — `pg_notify` → SSE → `RoomLive` — has been fully built since Phase 6 and
**completely inert**, because the run was always over before the page rendered. `docs/14-crews.md`
says so in as many words.

## Postgres is the broker

No Redis, no second pm2 process. `SELECT … FOR UPDATE SKIP LOCKED` is the standard primitive for
this exact problem, and this app already uses Postgres for LISTEN/NOTIFY, so it is not a new
dependency either.

```sql
UPDATE jobs SET status='running', attempts=attempts+1, locked_at=now(), locked_by=$1, heartbeat_at=now()
WHERE id = (
  SELECT id FROM jobs
   WHERE (status='queued' AND run_after <= now())
      OR (status='running' AND heartbeat_at < now() - interval '90000 milliseconds')
   ORDER BY run_after FOR UPDATE SKIP LOCKED LIMIT 1
) RETURNING *;
```

`SKIP LOCKED` is what makes it safe if a second worker ever exists: concurrent claimers step over
each other's locked rows rather than blocking or handing the same job to two workers.

**Staleness is computed by Postgres, not Node.** Passing a JS `Date` as a bind parameter is rejected
by postgres.js outright — but the better reason is that the database clock is the only one the
heartbeat writer and the reclaimer both agree on. Comparing a Postgres-written timestamp against a
Node-computed cutoff makes clock skew a correctness bug.

## The worker

In-process, started from Next's `instrumentation.ts` hook. Guarded three ways, each for a real
failure:

- `NEXT_RUNTIME === 'nodejs'` — the hook also fires for the edge runtime, which has no database.
- A module-level `started` flag — `next dev` calls `register()` more than once, and without it every
  reload would add another polling loop against the same table.
- `NEXT_PHASE !== 'phase-production-build'` — `next build` executes this module, and a build must not
  start polling a production database.

One process means **one job at a time**. That is a real limit and an honest one: crew runs are
minutes-long and rare, not a stream.

## Delivery is at-least-once

A worker can die after doing the work and before marking the job done, so every handler must be
idempotent. `executeCrewRun`'s existing `if (run.status !== 'queued') return run` guard is what makes
`crew.run` safe — it is load-bearing, not defensive clutter.

A partial unique index keeps one live job per crew run, so a double-submitted form is a no-op rather
than the same crew running twice.

## Cancellation is cooperative

`cancel_requested` is checked **between steps**. A step is one `runPersonaTurn` call and there is no
way to abort a provider request already in flight, so a cancel lands after the current persona
finishes speaking. The UI must say that rather than implying an instant stop.

`crew_run_status` gained a `cancelled` value. Without it, `TERMINAL_STATUS`'s fall-through would have
recorded a run somebody deliberately stopped as `completed` — a small lie, told every single time
anyone cancels.

## Two bugs found while verifying

**Every step duration in the audit trail was negative.** `recordStep` set `completedAt` from Node's
clock while `startedAt` used the column's `defaultNow()` — evaluated by Postgres at INSERT, which
happens *after* the step finishes. So `started_at` recorded when the step ended, and
`completed_at - started_at` came out negative by the round-trip time. Every duration was meaningless,
and since nothing has ever read `crew_run_steps`, nobody noticed. Now `startedAt` is captured before
the model call: real durations of 827ms, 908ms, 582ms where all three were negative.

**Parallel mode checked its budget only after the fan-out**, so a run already over budget still spent
a whole extra round before noticing. Now checked before.

## A bug a liveness probe found

Confirming the worker was actually polling — by enqueueing a job with no
registered handler and expecting it to fail — turned up something else. The job
failed as expected, then **requeued** despite `max_attempts = 1`.

`db.execute` returns the driver's rows **verbatim, in snake_case**. So
`RETURNING *` produced `max_attempts`, not `maxAttempts`, while TypeScript
insisted the row was a `JobRow`. `retryOrFail`'s `job.attempts >= job.maxAttempts`
was comparing a number against `undefined` — always false — so a permanently
failing job would have retried forever instead of giving up.

`claimNext` now returns `RETURNING id` and re-reads the row through Drizzle. One
extra primary-key lookup per claim is a rounding error next to a hand-maintained
snake-to-camel mapping that drifts the first time a column is added.

Worth stating plainly: the type said `JobRow` and was wrong. `db.execute` is
outside Drizzle's mapping, and a cast through `as unknown as` will not tell you.

## Verified

Against a real 3-persona crew running on the local Ollama model:

| Check | Result |
|---|---|
| Run executes off the request thread | ✅ `queued → completed`, 3 steps, 3 credits |
| Step durations | ✅ 827/908/582 ms (all negative before) |
| Crash recovery | ✅ job stranded by a dead worker reclaimed, attempts 1→2, completed |
| Cancellation | ✅ `cancelled` / `stop_reason=cancelled` / 0 steps / 0 credits |
| Double-submit | ✅ refused by the partial unique index |
| Worker starts exactly once | ✅ |
| A job with no handler gives up at `max_attempts` | ✅ `failed`, attempts 1 (retried forever before the fix) |

## Noted, not fixed

`runPersonaTurn` saves an **empty** model reply as `status: 'complete'`. The 1B local model returned
nothing on two of three turns and both were recorded as successful steps. Arguably a persona that
says nothing had a failed turn, but that is pre-existing group-chat behaviour shared with rooms, and
changing it would alter room behaviour too — it belongs with work that has decided what an empty
reply means.
