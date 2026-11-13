/**
 * Measures tutor turns through the real chat path (docs/53-tutor-measurement.md).
 *
 *   npx tsx scripts/tutor-bench.ts --label=before            # dry run: lists the cases, calls nothing
 *   npx tsx scripts/tutor-bench.ts --label=before --apply    # runs them (paid: one model call per turn)
 *   options: --persona=baseline-tutor  --only=y4-fractions,y2-add-wrong  --max-turns=10
 *            --base=https://freelee.cv  --keep (do not delete the test chats)
 *            --lesson   measure lessons (docs/54): each case gets a temporary child profile under the
 *                       admin account (year and subject of the case), its plan from curriculum's plan
 *                       pack, and a chat marked as that child's lesson — the "after" architecture.
 *                       Profiles (and with them plans and lessons) are deleted afterwards.
 *   run as: npx tsx --conditions=react-server scripts/tutor-bench.ts …  (lesson mode uses server modules)
 *
 * Each case starts a fresh chat owned by the admin, posts its turns to
 * /api/chat with a short-lived admin session (the same request a browser
 * sends), and reads back what the turn cost and what the reply looks like.
 *
 * What is measured, per turn:
 * - input/output tokens, credits and latency — the assistant row in `messages`,
 *   written by the route's own onFinish (so this is what a customer is billed);
 * - model steps and tool calls — counted from the response stream;
 * - the reply against the learner's year limits (since 2026-11-13: curriculum
 *   `GET /v1/years/:year/profile`, checked by src/lib/children/turn-check.ts —
 *   words and sentences per turn, sentence length, one question, no first
 *   person, no praise, no negatives in Year 1), or the level norms when the
 *   curriculum has no year profile (sentence length, reply length, phrases
 *   that level must never hear, exactly one question);
 * - the `Objective: CODE` line — the code must exist in the curriculum and
 *   belong to the learner's year or key stage.
 *
 * No AI judge: every check is plain code, so a run costs only the tutor turns.
 * Norms come from curriculum `GET /v1/years/:year/profile`, else `GET /v1/levels`
 * (item type "profile" on the key).
 * Results go to scripts/bench/results/
 * (not in git); the summary table is copied into docs/53 by hand.
 */
import { config } from 'dotenv';
import postgres from 'postgres';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { encode } from 'next-auth/jwt';
import { checkTurn, type YearChecks } from '../src/lib/children/turn-check';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

const arg = (name: string, fallback = '') =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3).trim() || fallback;

const label = arg('label', 'run');
const personaSlug = arg('persona', 'baseline-tutor');
const only = arg('only').split(',').map((s) => s.trim()).filter(Boolean);
const maxTurns = Number(arg('max-turns', '10'));
const base = arg('base', 'https://freelee.cv').replace(/\/+$/, '');
const apply = process.argv.includes('--apply');
const keep = process.argv.includes('--keep');
const lesson = process.argv.includes('--lesson');

type Case = { id: string; year: string; subject: string; turns: string[] };
type Norms = { sentenceWords: [number, number]; maxReplyWords: number; questionsPerReply: number; avoidPhrases: string[] };
type LevelTable = { years: Record<string, number>; levels: Record<string, Norms> };

const here = path.dirname(new URL(import.meta.url).pathname);
const cases: Case[] = JSON.parse(fs.readFileSync(path.join(here, 'bench/tutor-cases.json'), 'utf8')).cases
  .filter((c: Case) => only.length === 0 || only.includes(c.id));

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

/* ------------------------------ curriculum ------------------------------ */

async function curriculum(): Promise<{ baseUrl: string; apiKey: string } | null> {
  const rows = await sql`select key, value from settings where key in ('curriculum_api_key', 'curriculum_base_url')`;
  const get = (k: string) => rows.find((r) => r.key === k)?.value as string | undefined;
  const apiKey = get('curriculum_api_key') || process.env.CURRICULUM_API_KEY || '';
  if (!apiKey) return null;
  return { apiKey, baseUrl: (get('curriculum_base_url') || 'https://curriculum.ifairy.co.uk').replace(/\/+$/, '') };
}

async function curriculumGet(conn: { baseUrl: string; apiKey: string } | null, p: string): Promise<any | null> {
  if (!conn) return null;
  try {
    const res = await fetch(`${conn.baseUrl}${p}`, {
      headers: { authorization: `Bearer ${conn.apiKey}`, accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.ok ? body.data : null;
  } catch {
    return null;
  }
}

/** The year limits for each case year, where curriculum has them (year profiles, 2026-11-13). */
async function loadYearChecks(conn: Awaited<ReturnType<typeof curriculum>>, years: string[]): Promise<Record<string, YearChecks>> {
  const out: Record<string, YearChecks> = {};
  for (const year of [...new Set(years)]) {
    const profile = await curriculumGet(conn, `/v1/years/${encodeURIComponent(year)}/profile`);
    if (profile?.checks) out[year] = profile.checks;
  }
  return out;
}

/** Live norms when curriculum serves them; the local copy otherwise. Says which it used. */
async function loadNorms(conn: Awaited<ReturnType<typeof curriculum>>): Promise<{ table: LevelTable; source: string }> {
  const live = await curriculumGet(conn, '/v1/levels');
  if (live?.levels?.length) {
    const table: LevelTable = { years: {}, levels: {} };
    for (const level of live.levels) {
      // Live levels carry phrases per language ({ en, pl }); lessons run in English (owner decision).
      const ap = level.checks.avoidPhrases;
      table.levels[String(level.level)] = { ...level.checks, avoidPhrases: Array.isArray(ap) ? ap : ap?.en ?? [] };
      for (const year of level.years ?? []) table.years[year] = level.level;
    }
    return { table, source: 'curriculum /v1/levels' };
  }
  throw new Error('curriculum GET /v1/levels did not answer — the norms come from there (the key needs item type "profile").');
}

/* -------------------------------- checks -------------------------------- */

const KEY_STAGE_OF: Record<string, string> = {
  Y1: 'KS1', Y2: 'KS1', Y3: 'KS2', Y4: 'KS2', Y5: 'KS2', Y6: 'KS2', Y7: 'KS3', Y8: 'KS3', Y9: 'KS3', Y10: 'KS4', Y11: 'KS4',
};

/**
 * The reply the learner reads: without the Objective line, without the
 * `[SUGGESTIONS: …]` trailer the chat UI turns into buttons, and without
 * markdown emphasis.
 */
function visibleText(reply: string): string {
  return reply
    .replace(/^\s*\[SUGGESTIONS:.*\]\s*$/gim, '')
    .replace(/\[PROGRESS:[^\]]*\]/gi, '')
    .replace(/^\s*Objective:.*$/gim, '')
    .replace(/[*_`#>]/g, '')
    .trim();
}

function sentences(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => /[A-Za-z0-9]/.test(s));
}

const words = (s: string) => s.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;

type Check = { name: string; pass: boolean; detail: string };

/** The same five checks, held to the year's limits by the shared validator. */
function yearChecksFor(reply: string, year: YearChecks): Check[] {
  const r = checkTurn(reply, year);
  const has = (rule: string) => r.problems.filter((p) => p.rule === rule);
  const voice = r.problems.filter((p) => ['first person', 'praise', 'avoided phrase', 'negation', 'adult line'].includes(p.rule));
  const list = r.learnerText.split(/\n+|(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  const lastIsQuestion = list.length > 0 && list[list.length - 1].endsWith('?');
  return [
    { name: 'sentence length', pass: has('sentence length').length === 0 && has('sentences per turn').length === 0, detail: `longest ${r.longestSentence}, ${r.sentences} sentence(s) (limit ${year.sentenceWords[1]} words, ${year.maxSentencesPerTurn ?? '–'} sentences)` },
    { name: 'reply length', pass: has('turn length').length === 0, detail: `${r.words} words (target ${year.targetReplyWords ?? '–'}, limit ${year.maxReplyWords})` },
    { name: 'avoided phrases', pass: voice.length === 0, detail: voice.length ? voice.map((p) => `${p.rule}: ${p.detail}`).join('; ') : 'none' },
    { name: 'one question, last', pass: r.questions === 1 && lastIsQuestion && has('one question').length === 0, detail: `${r.questions} question(s)${has('one question').length ? ' (stacked)' : ''}, last is ${lastIsQuestion ? '' : 'not '}a question` },
  ];
}

async function checkReply(reply: string, c: Case, norms: Norms, year: YearChecks | undefined, conn: Awaited<ReturnType<typeof curriculum>>): Promise<Check[]> {
  const checks: Check[] = year ? yearChecksFor(reply, year) : levelChecks(reply, norms);
  return [...checks, await objectiveCheck(reply, c, conn)];
}

function levelChecks(reply: string, norms: Norms): Check[] {
  const text = visibleText(reply);
  const list = sentences(text);
  const lengths = list.map(words);
  const avg = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
  const longest = Math.max(0, ...lengths);
  const total = words(text);
  const [, maxWords] = norms.sentenceWords;
  const lower = text.toLowerCase();
  const said = norms.avoidPhrases.filter((p) => new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lower));
  const questions = list.filter((s) => s.endsWith('?'));
  const lastIsQuestion = list.length > 0 && list[list.length - 1].endsWith('?');

  const checks: Check[] = [
    { name: 'sentence length', pass: avg <= maxWords && longest <= Math.ceil(maxWords * 1.75), detail: `avg ${avg.toFixed(1)}, longest ${longest} (norm ≤ ${maxWords})` },
    { name: 'reply length', pass: total <= norms.maxReplyWords, detail: `${total} words (norm ≤ ${norms.maxReplyWords})` },
    { name: 'avoided phrases', pass: said.length === 0, detail: said.length ? `said: ${said.join(', ')}` : 'none' },
    { name: 'one question, last', pass: questions.length === norms.questionsPerReply && lastIsQuestion, detail: `${questions.length} question(s), last is ${lastIsQuestion ? '' : 'not '}a question` },
  ];
  return checks;
}

async function objectiveCheck(reply: string, c: Case, conn: Awaited<ReturnType<typeof curriculum>>): Promise<Check> {
  const code = reply.match(/Objective:\s*`?([A-Z]{2,3}-[A-Z0-9]+(?:-[A-Z0-9]+)?-\d{3})/)?.[1];
  if (!code) {
    return { name: 'objective code', pass: false, detail: 'no Objective line' };
  } else {
    const found = await curriculumGet(conn, `/v1/objectives/${encodeURIComponent(code)}`);
    const objective = found?.objective;
    const yearGroup: string = objective?.yearGroup ?? '';
    const fits = Boolean(objective) && (
      yearGroup === c.year ||
      yearGroup.split('-').includes(c.year) ||
      yearGroup === KEY_STAGE_OF[c.year] ||
      objective.keyStage === KEY_STAGE_OF[c.year]
    );
    return {
      name: 'objective code',
      pass: fits,
      detail: objective ? `${code} (${objective.keyStage} ${yearGroup}${fits ? '' : ` — learner is ${c.year}`})` : `${code} not found`,
    };
  }
}

/* ---------------------------- lesson mode ---------------------------- */

/**
 * A temporary child profile for one case, with its plan built from the
 * curriculum's plan pack — the same code path a parent's save takes. Imported
 * lazily: these modules need the server build conditions.
 */
async function lessonChild(adminId: string, teamId: string, c: Case): Promise<string> {
  const { createChild } = await import('../src/lib/children/store');
  const { childContext, ensurePlan } = await import('../src/lib/children/child-mode');
  const id = await createChild(adminId, teamId, {
    pseudonym: 'Bench', year: c.year as never, subjects: [c.subject === 'english grammar, punctuation and spelling' ? 'english' : c.subject],
    interests: [], adaptations: [], includePshe: false,
  });
  const ctx = await childContext(adminId, id);
  const built = ctx ? await ensurePlan(ctx, { rebuild: true }) : { plan: null, error: 'no context' };
  if (!built.plan) console.log(`  (no plan for ${c.id}: ${built.error ?? 'unknown'} — the lesson runs without one)`);
  return id;
}

/* ------------------------------ one turn ------------------------------- */

type UiMessage = { id: string; role: 'user' | 'assistant'; parts: { type: 'text'; text: string }[] };

async function postTurn(cookie: string, chatId: string, history: UiMessage[]) {
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ id: chatId, messages: history }),
  });
  if (!res.ok || !res.body) throw new Error(`chat answered ${res.status}: ${(await res.text()).slice(0, 200)}`);

  let text = '';
  let steps = 0;
  const tools: string[] = [];
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const event = JSON.parse(data);
        if (event.type === 'text-delta') text += event.delta ?? '';
        else if (event.type === 'start-step') steps += 1;
        else if (event.type === 'tool-input-available') tools.push(event.toolName);
        else if (event.type === 'error') throw new Error(event.errorText ?? 'stream error');
      } catch (error) {
        if (error instanceof SyntaxError) continue;
        throw error;
      }
    }
  }
  return { text, steps, tools };
}

/** onFinish writes the assistant row after the stream closes — wait for it briefly. */
async function assistantRow(chatId: string, position: number) {
  for (let i = 0; i < 40; i++) {
    const [row] = await sql`select input_tokens, output_tokens, credits_cost, latency_ms, model from messages
                             where chat_id = ${chatId} and role = 'assistant' and position = ${position}`;
    if (row) return row;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('assistant message was not recorded');
}

/* --------------------------------- run --------------------------------- */

try {
  const [persona] = await sql`select p.id, p.name, p.current_version_id from personas p where p.slug = ${personaSlug}`;
  if (!persona) throw new Error(`No persona "${personaSlug}". For Baseline Tutor run scripts/bench/baseline-tutor.ts --apply first.`);

  const totalTurns = cases.reduce((n, c) => n + c.turns.length, 0);
  console.log(`${persona.name} · ${cases.length} case(s), ${totalTurns} turn(s) · label "${label}"`);
  for (const c of cases) console.log(`  ${c.id.padEnd(16)} ${c.year.padEnd(4)} ${c.subject} · ${c.turns.length} turn(s)`);
  if (totalTurns > maxTurns) throw new Error(`${totalTurns} turns is over --max-turns=${maxTurns}. Narrow with --only or raise the cap on purpose.`);
  if (!apply) {
    console.log('\nDry run — nothing called. Add --apply (paid: one model call per turn).');
    process.exit(0);
  }

  const conn = await curriculum();
  const { table, source: levelSource } = await loadNorms(conn);
  const yearNorms = await loadYearChecks(conn, cases.map((c) => c.year));
  const yearsWith = Object.keys(yearNorms);
  const source = yearsWith.length ? `curriculum /v1/years (${yearsWith.join(', ')}); ${levelSource} for the rest` : levelSource;
  console.log(`Norms from ${source}.`);

  const [admin] = await sql`select id, email, default_team_id from users where is_admin order by created_at limit 1`;
  const cookieName = '__Secure-authjs.session-token';
  const token = await encode({
    token: { sub: admin.id, uid: admin.id, email: admin.email, isAdmin: true, defaultTeamId: admin.default_team_id },
    secret: process.env.AUTH_SECRET!,
    salt: cookieName,
    maxAge: 900,
  });
  const cookie = `${cookieName}=${token}`;

  const results: unknown[] = [];
  const created: string[] = [];
  const createdChildren: string[] = [];

  for (const c of cases) {
    const level = table.years[c.year];
    const norms = table.levels[String(level)];
    const chatId = randomUUID();
    let childId: string | null = null;
    if (lesson) {
      childId = await lessonChild(admin.id, admin.default_team_id, c);
      createdChildren.push(childId);
    }
    await sql`insert into chats (id, user_id, team_id, persona_id, title, child_profile_id)
              values (${chatId}, ${admin.id}, ${admin.default_team_id}, ${persona.id}, ${`bench ${label} ${c.id}`}, ${childId})`;
    created.push(chatId);

    const history: UiMessage[] = [];
    for (let t = 0; t < c.turns.length; t++) {
      history.push({ id: randomUUID(), role: 'user', parts: [{ type: 'text', text: c.turns[t] }] });
      const started = Date.now();
      const turn = await postTurn(cookie, chatId, history);
      const row = await assistantRow(chatId, 2 * (t + 1));
      history.push({ id: randomUUID(), role: 'assistant', parts: [{ type: 'text', text: turn.text }] });
      const checks = await checkReply(turn.text, c, norms, yearNorms[c.year], conn);
      const yearReport = yearNorms[c.year] ? checkTurn(turn.text, yearNorms[c.year]) : null;
      const passed = checks.filter((k) => k.pass).length;
      results.push({
        case: c.id, turn: t + 1, year: c.year, level, subject: c.subject, model: row.model,
        inputTokens: row.input_tokens, outputTokens: row.output_tokens, credits: row.credits_cost,
        latencyMs: row.latency_ms ?? Date.now() - started, steps: turn.steps, toolCalls: turn.tools.length, tools: turn.tools,
        checks, passed, reply: turn.text,
        ...(yearReport ? { learnerWords: yearReport.words, withinYearLimits: yearReport.problems.length === 0, yearProblems: yearReport.problems } : {}),
      });
      console.log(
        `${`${c.id}#${t + 1}`.padEnd(18)} L${level} in ${String(row.input_tokens).padStart(6)} out ${String(row.output_tokens).padStart(4)} ` +
          `credits ${String(row.credits_cost).padStart(4)} steps ${turn.steps} tools ${turn.tools.length} ` +
          `checks ${passed}/${checks.length}${checks.filter((k) => !k.pass).map((k) => ` ✗ ${k.name}: ${k.detail}`).join('')}`,
      );
    }
  }

  type Row = { inputTokens: number; outputTokens: number; credits: number; latencyMs: number; toolCalls: number; steps: number; passed: number; checks: Check[] };
  const rows = results as Row[];
  const sum = (f: (r: Row) => number) => rows.reduce((a, r) => a + f(r), 0);
  const n = rows.length;
  const summary = {
    label, persona: personaSlug, mode: lesson ? 'lesson (child plan in the prompt)' : 'tools only', at: new Date().toISOString(), turns: n, normsSource: source,
    avgInputTokens: Math.round(sum((r) => r.inputTokens) / n),
    avgOutputTokens: Math.round(sum((r) => r.outputTokens) / n),
    avgCredits: Math.round((sum((r) => r.credits) / n) * 10) / 10,
    totalCredits: sum((r) => r.credits),
    totalTokens: sum((r) => r.inputTokens + r.outputTokens),
    avgToolCalls: Math.round((sum((r) => r.toolCalls) / n) * 100) / 100,
    avgSteps: Math.round((sum((r) => r.steps) / n) * 100) / 100,
    avgLatencyMs: Math.round(sum((r) => r.latencyMs) / n),
    checksPassed: `${sum((r) => r.passed)}/${sum((r) => r.checks.length)}`,
    turnsAllPassed: rows.filter((r) => r.passed === r.checks.length).length,
    // Year limits (2026-11-13): turns whose learner-facing text kept every limit of its year.
    turnsWithinYearLimits: (results as { withinYearLimits?: boolean }[]).filter((r) => r.withinYearLimits === true).length,
    turnsMeasuredAgainstYear: (results as { withinYearLimits?: boolean }[]).filter((r) => r.withinYearLimits !== undefined).length,
  };
  console.log('\nSummary', summary);

  const outDir = path.join(here, 'bench/results');
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${summary.at.slice(0, 10)}-${label}.json`);
  fs.writeFileSync(file, JSON.stringify({ summary, results }, null, 2));
  console.log(`Saved ${path.relative(process.cwd(), file)}`);

  if (!keep && created.length) {
    await sql`delete from messages where chat_id in ${sql(created)}`;
    await sql`delete from chats where id in ${sql(created)}`;
    console.log(`Deleted ${created.length} test chat(s) (billing rows stay, as for any chat).`);
  }
  if (!keep && createdChildren.length) {
    await sql`delete from child_profiles where id in ${sql(createdChildren)}`;
    console.log(`Deleted ${createdChildren.length} temporary child profile(s) with their plans.`);
  }
} finally {
  await sql.end();
}
