/**
 * Creates (or brings back in line) Baseline Tutor, the plain teacher used to
 * measure tutor turns (docs/53-tutor-measurement.md).
 *
 *   npx tsx scripts/bench/baseline-tutor.ts           # dry run: prints what it would write
 *   npx tsx scripts/bench/baseline-tutor.ts --apply
 *
 * Why a separate persona and not Pan Kleks: a measurement needs a teacher with
 * no world, no voice and no long backstory, so that a number moves only when
 * the architecture moves. Every character later imported is measured against
 * this one; the difference is what the character itself costs.
 *
 * The persona is inactive (never listed in the marketplace) and private. The
 * bench creates its chats directly, so it does not need to be listed to be
 * talked to. Unpinned: re-running this script updates the current version in
 * place, which is what a measurement fixture should do.
 */
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

export const BASELINE_SLUG = 'baseline-tutor';

/** Kept short on purpose — about 150 words. Every rule here is one the bench checks. */
export const BASELINE_PROMPT = [
  'You are Baseline Tutor, a plain and kind teacher. Your answers are measured, so keep to this format every time.',
  '',
  '- Teach one small step per reply.',
  '- Reply in three parts: a short explanation, one worked example, then exactly one question for the learner. Ask no other questions.',
  "- Match the learner's age: very short, simple sentences for young children, fuller sentences for teenagers.",
  '- Never call a task easy or simple. Never say an answer is wrong or bad. Never compare the learner with other children. When an answer is not right, give a hint and let them try again.',
  "- Teach only within the learner's year and subject.",
  '- End every reply with a final line `Objective: CODE`: the curriculum objective code you are teaching — from your learning plan if you have one, otherwise check the curriculum once.',
  '- No stories, no character voice, no emoji, no headings.',
].join('\n');

const SCOPE = {
  keyStages: ['KS1', 'KS2', 'KS3', 'KS4'],
  subjects: ['mathematics', 'english', 'english reading', 'english grammar, punctuation and spelling', 'science'],
};

const VERSION = {
  ai_provider: 'openai',
  // Same tier as Pan Kleks (resolves to the same model), so before/after compare like with like.
  model_tier: 'balanced',
  temperature: 0.2,
  // gpt-5.5 reasons before it answers and the cap counts those tokens too: 350 cut
  // three replies of the first run mid-sentence. Reply length is held by the prompt.
  max_tokens: 1200,
  history_messages: 6,
  audience_type: 'B2C',
  audience_segments: ['B2C-CYP-02', 'B2C-CYP-03', 'B2C-CYP-04', 'B2C-CYP-05'],
};

const apply = process.argv.includes('--apply');
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

try {
  const [admin] = await sql`select id, default_team_id from users where is_admin order by created_at limit 1`;
  if (!admin?.default_team_id) throw new Error('No admin user with a team — Baseline Tutor belongs to the admin team.');

  const [existing] = await sql`select id, current_version_id from personas where slug = ${BASELINE_SLUG}`;
  console.log(existing ? `Baseline Tutor exists (persona ${existing.id}) — current version updated in place.` : 'Baseline Tutor will be created.');
  console.log(`Prompt: ${BASELINE_PROMPT.split(/\s+/).length} words. Tier ${VERSION.model_tier}, temperature ${VERSION.temperature}, max ${VERSION.max_tokens} tokens, history ${VERSION.history_messages}.`);

  if (!apply) {
    console.log('\nDry run — nothing written. Add --apply.');
  } else {
    await sql.begin(async (tx) => {
      const scope = tx.json(SCOPE);
      const segments = tx.json(VERSION.audience_segments);
      let personaId: number = existing?.id;
      if (!personaId) {
        const [created] = await tx`
          insert into personas (name, slug, tagline, description, expertise, system_prompt, ai_provider, model_tier,
                                temperature, max_tokens, history_messages, audience_type, audience_segments,
                                team_id, visibility, is_active, pin_versioning)
          values ('Baseline Tutor', ${BASELINE_SLUG}, 'Plain teacher used to measure tutor answers',
                  'Admin-only measurement fixture (docs/53). Not listed.', 'Primary and secondary curriculum',
                  ${BASELINE_PROMPT}, ${VERSION.ai_provider}, ${VERSION.model_tier}, ${VERSION.temperature},
                  ${VERSION.max_tokens}, ${VERSION.history_messages}, ${VERSION.audience_type}, ${segments},
                  ${admin.default_team_id}, 'private', false, false)
          returning id`;
        personaId = created.id;
      }
      if (existing?.current_version_id) {
        await tx`
          update persona_versions set system_prompt = ${BASELINE_PROMPT}, ai_provider = ${VERSION.ai_provider},
                 model = null, model_tier = ${VERSION.model_tier}, temperature = ${VERSION.temperature},
                 max_tokens = ${VERSION.max_tokens}, history_messages = ${VERSION.history_messages},
                 audience_type = ${VERSION.audience_type}, audience_segments = ${segments},
                 curriculum_scope = ${scope}, tools = '[]'::jsonb, grounding_sources = '[]'::jsonb, updated_at = now()
           where id = ${existing.current_version_id}`;
      } else {
        const [version] = await tx`
          insert into persona_versions (persona_id, version, changelog, status, is_immutable, system_prompt,
                                        ai_provider, model_tier, temperature, max_tokens, history_messages,
                                        audience_type, audience_segments, curriculum_scope, published_at)
          values (${personaId}, '1.0.0', 'Baseline Tutor for measurements', 'published', false, ${BASELINE_PROMPT},
                  ${VERSION.ai_provider}, ${VERSION.model_tier}, ${VERSION.temperature}, ${VERSION.max_tokens},
                  ${VERSION.history_messages}, ${VERSION.audience_type}, ${segments}, ${scope}, now())
          returning id`;
        await tx`update personas set current_version_id = ${version.id}, updated_at = now() where id = ${personaId}`;
      }
      await tx`update personas set system_prompt = ${BASELINE_PROMPT}, is_active = false, visibility = 'private',
                                   updated_at = now() where id = ${personaId}`;
    });
    console.log('Written.');
  }
} finally {
  await sql.end();
}
