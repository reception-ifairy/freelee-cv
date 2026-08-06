# UK Marketplace Taxonomy

Implemented 2026-08-03, sourced from a reference schema (`uk_ai_marketplace_db` — a standalone UK AI
bot marketplace database design) whose 20 category names turned out to already match the live
`categories` table 1:1. Full background and what was *not* carried over lives in
`uk-marketplace-taxonomy-extract.md` at the project root — this page documents what actually shipped.

## Categories — richer market context

`categories` gained six columns: `ukMarketSize`, `ukGrowthRate`, `ukKeyRegulations` (jsonb array),
`ukIndustryBodies` (jsonb array), `defaultRiskLevel` (enum R0-R3), `narrativePotential` (enum
low/medium/high/very_high). Backfilled for all 20 live rows by exact name match.
`defaultRiskLevel` is **derived**, not copied from the source dump (whose own value was a flat,
never-computed `R0` on every row) — it's the highest-severity `typicalRiskLevel` among the category's
own sectors, so e.g. *Health and Medicine* and *Legal and Compliance* correctly land on `R2`.

## Sectors — new table, own admin section

`sectors`: `categoryId` (FK cascade), `code` (natural key, e.g. `CAT-03-SEC-01`), `name`, `slug`,
`description`, `b2cSuitability`/`b2bSuitability`/`b2gSuitability` (0-100), `typicalRiskLevel`,
`narrativeFit`, `primaryInteractionModes` (jsonb array of FAQ/COACH/AGENT/ANALYST/NARRATOR tags).
103 rows, backfilled from a curated dump matched to live categories by name. Managed at
`/admin/sectors` — a **top-level** nav item (deliberately not nested inside category editing), with a
category filter.

## Guardrails — prompt-only safety catalog

`src/lib/persona/guardrails.ts` — 14 static entries (`GUARDRAILS: Record<string, GuardrailConfig>`),
each with `severity` (low/medium/high/critical), `action` (warn/redirect/block/escalate), and a
ready-to-use `responseTemplate` with real UK helplines:

| Code | Covers |
|---|---|
| `GR-CRISIS-MENTAL`, `GR-CRISIS-SELF-HARM` | Samaritans 116 123, SHOUT to 85258 |
| `GR-MEDICAL-DIAGNOSIS`, `GR-MEDICAL-PRESCRIPTION` | GP / NHS 111, no dosage advice |
| `GR-FINANCE-ADVICE`, `GR-FINANCE-INVESTMENT` | FCA-authorised adviser referral |
| `GR-LEGAL-ADVICE`, `GR-IMMIGRATION-ADVICE` | Solicitor / OISC-registered adviser |
| `GR-CHILD-SAFETY`, `GR-SAFEGUARDING` | NSPCC 0808 800 5000, Childline 0800 1111 |
| `GR-PII-COLLECTION`, `GR-DATA-MINIMISATION` | GDPR-flavoured nudges |
| `GR-NHS-EMERGENCY` | 999 / A&E / NHS 111 |
| `GR-UK-COMPLIANCE` | Jurisdiction disclaimer |

`personas.guardrails` (jsonb `string[]` of codes) is editable in the persona form's **capabilities**
tab, grouped by severity. `buildSystemPrompt` (`src/lib/persona/prompt.ts`) compiles the active ones
into a `## Guardrails` section — verified end-to-end by direct invocation, confirmed the compiled
prompt includes the real Samaritans number.

**This is prompt-only, by deliberate decision** — no runtime keyword/regex scanning of user input or
model output exists anywhere in `route.ts`. Matches the app's pre-existing safety posture (100%
prompt-based; `capabilities.badwordFilter` was already stored but read nowhere).

## Audience segments — cataloguing only, not yet live behavior

`src/lib/persona/audience-segments.ts` — 70 static entries (26 B2C, 23 B2B, 21 B2G), each with
`keyNeeds`, `riskSensitivity`, `narrativeFit`, and (B2C) an age range. `personas.audienceSegments`
(jsonb `string[]`) is editable in the persona form's **personality** tab as collapsible `<details>`
groups per audience type.

**Deliberately not wired into the system prompt or any matching/recommendation logic** — this is the
cataloguing + tagging foundation for a future "which segment is this user, which personas fit them"
feature, not that feature itself.

## Where this doesn't reach

Compliance tags (~60) and UK regulatory bodies (~21) from the source schema were **not** ported as
their own catalog — each guardrail keeps its own `complianceTags`/`regulatoryReference` fields
inline, which was enough for what shipped. `interactionStyle` (persona *tone*: formal/casual/etc.)
and `primaryInteractionModes` (sector *behavior*: FAQ/COACH/AGENT/etc.) remain two separate,
unmerged axes.
