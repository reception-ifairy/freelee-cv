-- A durable job queue.
--
-- Crew runs execute inline inside the server action today (crews/actions.ts
-- awaits executeCrewRun before redirecting), which is why crews.max_turns
-- defaults to 6: a run has to finish inside one HTTP request. That ceiling is
-- what limits everything bot teamwork could become, and it also makes the
-- SSE/realtime path — which is fully built — inert, because the run is always
-- over before the page renders.
--
-- Postgres is the queue. No Redis, no new pm2 process: SELECT ... FOR UPDATE
-- SKIP LOCKED is the standard primitive for exactly this, and this app already
-- uses Postgres for LISTEN/NOTIFY.

DO $$ BEGIN
  CREATE TYPE "job_status" AS ENUM ('queued', 'running', 'done', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "jobs" (
  "id"           text PRIMARY KEY,
  -- 'crew.run' is the only kind today. Kept generic so scheduled runs, digest
  -- emails and the usage rollups scoped in earlier phases get a home without
  -- another migration.
  "kind"         text NOT NULL,
  "payload"      jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status"       "job_status" NOT NULL DEFAULT 'queued',
  "attempts"     integer NOT NULL DEFAULT 0,
  "max_attempts" integer NOT NULL DEFAULT 3,
  -- Scheduling and retry backoff in one column: "not before this time" is the
  -- same question whether it is a delay or a second try.
  "run_after"    timestamptz NOT NULL DEFAULT now(),
  "locked_at"    timestamptz,
  -- Which worker holds it. Makes a stuck job diagnosable instead of a mystery.
  "locked_by"    text,
  -- Liveness, deliberately separate from locked_at: a long job is not a dead
  -- one, and only a stale heartbeat distinguishes them.
  "heartbeat_at" timestamptz,
  -- Cooperative cancellation. The runner checks it between steps; it cannot
  -- interrupt a model call already in flight.
  "cancel_requested" boolean NOT NULL DEFAULT false,
  "last_error"   text,
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  "updated_at"   timestamptz NOT NULL DEFAULT now()
);

-- Partial: the claim query only ever looks at queued rows, and a jobs table
-- that keeps its history grows forever.
CREATE INDEX IF NOT EXISTS "jobs_claim_idx" ON "jobs" ("run_after") WHERE "status" = 'queued';
-- For reclaiming work from a worker that died mid-job.
CREATE INDEX IF NOT EXISTS "jobs_running_idx" ON "jobs" ("heartbeat_at") WHERE "status" = 'running';
-- One live job per crew run, so a double-submit cannot run the same crew twice.
CREATE UNIQUE INDEX IF NOT EXISTS "jobs_crew_run_idx"
  ON "jobs" ((("payload"->>'crewRunId')))
  WHERE "kind" = 'crew.run' AND "status" IN ('queued', 'running');

-- A cancelled run is not a completed one and not a failed one.
-- Without this value, TERMINAL_STATUS's fall-through would record a run
-- somebody deliberately stopped as 'completed' — a small lie told every time.
ALTER TYPE "crew_run_status" ADD VALUE IF NOT EXISTS 'cancelled';
