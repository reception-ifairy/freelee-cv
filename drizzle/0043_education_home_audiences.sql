-- Education serves children and families too (owner decision 2026-11-14).
--
-- Data only, no schema change. Until now Education & Training linked only the
-- institutions it is sold to (private providers, EdTech, schools, FE,
-- universities): no learner, no parent, no home-educated child, although
-- homeschooling is one of freelee's two live offerings. These links feed the
-- category brief and the workbench drafts (docs/49); a persona's prompt reads
-- its own segments, filtered by its audience type (freelee #77).
--
-- Risk goes from R0 to R2 for the same reason: children. defaultRiskLevel is
-- read by the brief, the workbench and the category form only, so no live
-- persona changes; drafts designed here get the R2 guardrails.
--
-- Matched on slugs and codes, so it is safe to re-run and safe on a database
-- whose ids differ. Applied with psql like every file here.
INSERT INTO "category_audience_segments" ("category_id", "segment_code", "note", "position")
SELECT c."id", v."code", v."note", v."position"
FROM "categories" c
JOIN (VALUES
  ('education-and-training', 'B2C-CYP-08', 'Home-educated children — the homeschooling offering; the plan comes from the curriculum.', 5),
  ('education-and-training', 'B2C-GK-01',  'Parents who choose, pay and read every lesson.', 6),
  ('education-and-training', 'B2C-GK-02',  'The second parent, who follows progress.', 7),
  ('education-and-training', 'B2C-GK-04',  'Carers and guardians with legal responsibility for a child.', 8),
  ('education-and-training', 'B2C-ADU-03', 'Parents of young children looking for activities and support.', 9),
  ('education-and-training', 'B2C-CYP-01', 'Early years: Reception and nursery.', 10),
  ('education-and-training', 'B2C-CYP-02', 'Key Stage 1 learners (Years 1–2): adult-led sessions.', 11),
  ('education-and-training', 'B2C-CYP-03', 'Key Stage 2 learners (Years 3–6).', 12),
  ('education-and-training', 'B2C-CYP-04', 'Key Stage 3 learners (Years 7–9).', 13),
  ('education-and-training', 'B2C-CYP-05', 'GCSE students (Years 10–11), often private candidates at home.', 14),
  ('education-and-training', 'B2C-CYP-06', 'Post-16 students.', 15),
  ('education-and-training', 'B2C-CYP-07', 'SEND learners: adaptations are practical instructions, never a diagnosis.', 16)
) AS v("slug", "code", "note", "position") ON v."slug" = c."slug"
ON CONFLICT ("category_id", "segment_code") DO NOTHING;

UPDATE "categories" SET "default_risk_level" = 'R2'
WHERE "slug" = 'education-and-training' AND "default_risk_level" IS DISTINCT FROM 'R2';
