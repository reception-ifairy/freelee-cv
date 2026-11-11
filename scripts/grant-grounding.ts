/**
 * Grant knowledge shelves (or remote sources) to many personas at once.
 *
 *   npx tsx scripts/grant-grounding.ts --personas=sales-a1,bizcoach-b1 \
 *     --sources=lib:strategy-frameworks,lib:business-plan-method            # dry run
 *   ... --apply                                                             # write
 *
 * The persona form grants shelves one bot at a time, and for a pinned persona
 * a grant is a new published version — eleven bots is eleven forms, eleven
 * publishes. This does the same thing in one transaction, through the same
 * rules the form follows:
 *
 * - **Pinned personas** get a new published version cloned from the current
 *   one with the sources added — patch bump, immutable, a changelog line —
 *   exactly what Save and publish produces. Published versions are never edited
 *   in place; that is the promise pinning makes.
 * - **Unpinned personas** have their current version updated in place, as the
 *   form does.
 * - A persona with an **unpublished draft** is refused, not published: the
 *   draft is someone's unfinished work, and publishing it as a side effect of a
 *   grant would ship whatever state it is in.
 * - Every key must already exist (a `lib:` shelf in library_collections, or an
 *   active knowledge source) — a typo must fail loudly, not grant nothing.
 *
 * Dry run by default; prints what would change and changes nothing.
 */
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

function arg(name: string): string[] {
  const value = process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? '';
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}

const slugs = arg('personas');
const sources = arg('sources');
const apply = process.argv.includes('--apply');
const changelog = process.argv.find((a) => a.startsWith('--changelog='))?.slice('--changelog='.length).trim() || `Knowledge: ${sources.join(', ')}`;

if (slugs.length === 0 || sources.length === 0) {
  console.error('Usage: --personas=<slug,...> --sources=<lib:key|source-key,...> [--apply] [--changelog=text]');
  process.exit(1);
}

/** Same rule as nextPatchVersion() in src/server/actions/admin.ts. */
function nextPatchVersion(version: string): string {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return '1.0.1';
  const [, major, minor, patch] = match;
  return `${major}.${minor}.${Number(patch) + 1}`;
}

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

try {
  const shelves = (await sql`select key from library_collections where is_active`).map((r) => `lib:${r.key}`);
  const remote = (await sql`select key from knowledge_sources where is_active`).map((r) => String(r.key));
  const known = new Set([...shelves, ...remote]);
  const unknown = sources.filter((s) => !known.has(s));
  if (unknown.length) throw new Error(`Unknown source key(s): ${unknown.join(', ')}. Known: ${[...known].join(', ')}`);

  const personas = await sql`
    select p.id, p.slug, p.name, p.pin_versioning, p.draft_version_id, p.current_version_id,
           v.version, v.grounding_sources
      from personas p
      join persona_versions v on v.id = p.current_version_id
     where p.slug in ${sql(slugs)}`;
  const missing = slugs.filter((s) => !personas.some((p) => p.slug === s));
  if (missing.length) throw new Error(`No persona with slug: ${missing.join(', ')}`);

  const blocked = personas.filter((p) => p.pin_versioning && p.draft_version_id);
  if (blocked.length) {
    throw new Error(`Unpublished draft on: ${blocked.map((p) => p.slug).join(', ')} — publish or discard it first.`);
  }

  const plan = personas.map((p) => {
    const current: string[] = Array.isArray(p.grounding_sources) ? p.grounding_sources : [];
    const added = sources.filter((s) => !current.includes(s));
    return { ...p, next: [...current, ...added], added };
  });

  for (const p of plan) {
    const how = p.added.length === 0
      ? 'already has them'
      : p.pin_versioning ? `new version ${nextPatchVersion(p.version)} (from ${p.version})` : `current version ${p.version} updated in place`;
    console.log(`${p.slug.padEnd(24)} +${p.added.length}  ${how}`);
  }

  if (!apply) {
    console.log('\nDry run — nothing written. Add --apply to grant.');
  } else {
    await sql.begin(async (tx) => {
      for (const p of plan) {
        if (p.added.length === 0) continue;
        const grounding = tx.json(p.next);
        if (p.pin_versioning) {
          const [created] = await tx`
            insert into persona_versions (
              persona_id, version, changelog, status, is_immutable, system_prompt, welcome_message, suggestions,
              ai_provider, model, model_tier, temperature, top_p, frequency_penalty, presence_penalty, max_tokens,
              history_messages, audience_type, personality, knowledge_domains, capabilities, grounding_sources,
              guardrails, audience_segments, blueprint, interaction_style, approach_to_unknown, prompt_technique,
              thinking_mode, published_at, authored_by_team_id, chat_layout, tools)
            select persona_id, ${nextPatchVersion(p.version)}, ${changelog}, 'published', true, system_prompt,
                   welcome_message, suggestions, ai_provider, model, model_tier, temperature, top_p,
                   frequency_penalty, presence_penalty, max_tokens, history_messages, audience_type, personality,
                   knowledge_domains, capabilities, ${grounding}, guardrails, audience_segments, blueprint,
                   interaction_style, approach_to_unknown, prompt_technique, thinking_mode, now(),
                   authored_by_team_id, chat_layout, tools
              from persona_versions where id = ${p.current_version_id}
            returning id`;
          await tx`update personas set current_version_id = ${created.id}, grounding_sources = ${grounding}, updated_at = now() where id = ${p.id}`;
        } else {
          await tx`update persona_versions set grounding_sources = ${grounding}, updated_at = now() where id = ${p.current_version_id}`;
          await tx`update personas set grounding_sources = ${grounding}, updated_at = now() where id = ${p.id}`;
        }
      }
    });
    console.log(`\nGranted to ${plan.filter((p) => p.added.length).length} persona(s).`);
  }
} finally {
  await sql.end();
}
