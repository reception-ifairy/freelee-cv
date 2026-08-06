-- Phase 1 (teams retrofit), step 2 of 2. Run only after the backfill script
-- (scratchpad, snapshot-first + RAISE EXCEPTION assertion) has committed
-- cleanly against production and every row has been verified populated.
--
-- Also makes the users<->teams circular FK pair DEFERRABLE INITIALLY
-- DEFERRED, which is what lets registerAction (src/server/actions/auth.ts)
-- insert a brand-new user and their personal team in one transaction
-- regardless of statement order — with immediate (default) constraint
-- checking, either insert alone would fail its FK check before the other
-- row exists. Deferring only changes *when* the constraint is checked (at
-- COMMIT, not per-statement); it does not relax what's allowed to end up
-- committed.

ALTER TABLE "users" ALTER COLUMN "default_team_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "personas" ALTER COLUMN "team_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "chats" ALTER COLUMN "team_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "team_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_ledger" ALTER COLUMN "team_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "teams" DROP CONSTRAINT "teams_owner_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_owner_id_users_id_fk"
	FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id")
	DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint

ALTER TABLE "users" DROP CONSTRAINT "users_default_team_id_teams_id_fk";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_default_team_id_teams_id_fk"
	FOREIGN KEY ("default_team_id") REFERENCES "public"."teams"("id")
	ON DELETE SET NULL
	DEFERRABLE INITIALLY DEFERRED;
