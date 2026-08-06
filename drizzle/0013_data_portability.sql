-- Phase 8 of the teams/marketplace-concept integration: data portability.
-- One new table — externalIdMap, the idempotency mechanism for
-- scripts/import-bundle.ts. See docs/15-data-portability.md.

CREATE TABLE "external_id_map" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"external_id" text NOT NULL,
	"local_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX "external_id_map_unique_idx" ON "external_id_map" USING btree ("team_id","entity_type","external_id");--> statement-breakpoint

ALTER TABLE "external_id_map" ADD CONSTRAINT "external_id_map_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
