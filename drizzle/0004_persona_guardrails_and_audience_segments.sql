ALTER TABLE "personas" ADD COLUMN "guardrails" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "personas" ADD COLUMN "audience_segments" jsonb DEFAULT '[]'::jsonb NOT NULL;
