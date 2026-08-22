-- The starting set of category → audience links.
--
-- Separate from 0037 (which creates the table) and ordered after 0038 (which
-- creates the categories), because this matches on category slug and a fresh
-- database has no categories when 0037 runs. Restoring into an empty database
-- is what surfaced that — the seed silently inserted zero rows.
--
-- Twelve of the B2B segments name an industry outright (Legal Services,
-- Healthcare, Financial Services, Creative Industries, HR and Recruitment …)
-- and several B2G ones are the public-sector half of a field we already have a
-- category for, so most of this maps itself. What is left is judgement, and
-- that part is picked in the panel rather than guessed here.
--
-- Not exhaustive on purpose: an empty audience on a category is an honest
-- "nobody has decided yet", and a wrong one is worse than none, because it
-- goes into the brief a persona gets designed against.

-- The obvious matches: twelve B2B-SEC segments are industries by name, and
-- several B2G-PUB ones are the public-sector half of a field we already have a
-- category for. Matched on category slug so this is safe to re-run and safe on
-- a database whose category ids differ (ours start at 29, not 1).
INSERT INTO "category_audience_segments" ("category_id", "segment_code", "note")
SELECT c."id", v."code", v."note"
FROM "categories" c
JOIN (VALUES
  ('legal-and-compliance',                   'B2B-SEC-05', 'Law firms and in-house teams — the buyers as well as the subject.'),
  ('health-and-medicine',                    'B2B-SEC-03', 'Private healthcare providers.'),
  ('health-and-medicine',                    'B2G-PUB-06', 'NHS trusts — the same field, a different risk posture and procurement route.'),
  ('business-and-finance',                   'B2B-SEC-04', 'Financial services, where the regulator is part of the product.'),
  ('education-and-training',                 'B2B-SEC-01', 'Private education providers.'),
  ('education-and-training',                 'B2B-SEC-02', 'EdTech companies building on top of this.'),
  ('education-and-training',                 'B2G-PUB-01', 'State schools — the largest audience in this field and the most constrained.'),
  ('education-and-training',                 'B2G-PUB-03', 'FE colleges.'),
  ('education-and-training',                 'B2G-PUB-04', 'Universities.'),
  ('creative-arts-and-design',               'B2B-SEC-08', 'The creative industries themselves.'),
  ('travel-and-hospitality',                 'B2B-SEC-07', 'Hospitality and tourism operators.'),
  ('human-resources-and-career-development', 'B2B-SEC-12', 'HR and recruitment — practitioners, not just users.'),
  ('human-resources-and-career-development', 'B2B-FUN-05', 'HR operations as a function inside any employer.'),
  ('sales-and-customer-support',             'B2B-SEC-06', 'Retail and e-commerce.'),
  ('sales-and-customer-support',             'B2B-FUN-02', 'Customer success teams.'),
  ('sales-and-customer-support',             'B2B-FUN-04', 'Sales teams.'),
  ('marketing-and-advertising',              'B2B-FUN-03', 'Marketing teams — the people who would run this.'),
  ('digital-marketing',                      'B2B-FUN-03', 'Marketing teams.'),
  ('engineering-and-architecture',           'B2B-SEC-10', 'Manufacturing.'),
  ('environment-and-sustainability',         'B2G-LOC-03', 'Unitary authorities, where most local environmental duties sit.'),
  ('entertainment-and-media',                'B2B-SEC-08', 'Creative industries.'),
  ('writing-and-content-creation',           'B2B-FUN-06', 'Internal communications.'),
  ('science-and-research',                   'B2G-PUB-04', 'Universities.'),
  ('technology-and-web-development',         'B2B-SIZE-01', 'Solo developers and micro-agencies.'),
  ('virtual-assistance',                     'B2B-SIZE-01', 'Solo operators, who are this field''s core buyer.'),
  ('virtual-assistance',                     'B2B-SIZE-02', 'Micro businesses.')
) AS v("slug", "code", "note") ON v."slug" = c."slug"
ON CONFLICT ("category_id", "segment_code") DO NOTHING;
