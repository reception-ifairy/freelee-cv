import { createHash } from 'node:crypto';
import type { PersonaCapabilities } from '@/db/schema';

/**
 * The misleadingly named personattest.json is six concatenated MySQL INSERT
 * statements.  This parser reads their literals; it never executes source SQL.
 */
export const LEGACY_PROMPT_COLUMNS = [
  'id', 'name', 'slug', 'image', 'status', 'description', 'welcome_message', 'expert', 'prompt',
  'display_welcome_message', 'temperature', 'frequency_penalty', 'presence_penalty', 'chat_minlength',
  'chat_maxlength', 'max_num_chats_api', 'API_MODEL', 'display_API_MODEL', 'use_google_voice',
  'use_cloud_google_voice', 'display_mp3_google_cloud_text', 'google_voice', 'google_voice_lang_code',
  'cloud_google_voice', 'cloud_google_voice_lang_code', 'cloud_google_voice_gender', 'display_description',
  'display_mic', 'mic_speak_lang', 'display_avatar', 'display_copy_btn', 'filter_badwords',
  'display_contacts_user_list', 'item_order', 'display_prompts_output', 'display_prompts_tone',
  'display_prompts_writing', 'id_prompts_output_default', 'id_prompts_tone_default',
  'id_prompts_writing_default', 'display_suggestions', 'suggestions', 'allow_embed_chat',
  'array_message_history', 'array_message_limit_length', 'display_share', 'use_dalle',
  'use_mic_whisper', 'use_vision',
] as const;

export type LegacyPromptColumn = (typeof LEGACY_PROMPT_COLUMNS)[number];
export type LegacyValue = string | number | null;

export type LegacyPromptRow = Record<LegacyPromptColumn, LegacyValue> & {
  sourceBlock: number;
  sourceLine: number;
};

export type LegacyPromptCharacter = LegacyPromptRow & {
  sourceRefs: { block: number; line: number; id: number }[];
  sourceKey: string;
};

export type LegacyParseResult = {
  rows: LegacyPromptRow[];
  characters: LegacyPromptCharacter[];
  duplicateGroups: { sourceKey: string; refs: LegacyPromptCharacter['sourceRefs'] }[];
  insertBlocks: number;
  sourceSha256: string;
};

function decodeMysqlEscape(character: string): string {
  return ({
    '0': '\0', b: '\b', n: '\n', r: '\r', t: '\t', Z: '\x1a',
    '\\': '\\', "'": "'", '"': '"',
  } as Record<string, string>)[character] ?? character;
}

function parseTuple(line: string, lineNumber: number): LegacyValue[] {
  const values: LegacyValue[] = [];
  let cursor = 1;

  if (!line.startsWith('(')) throw new Error(`Line ${lineNumber}: expected a tuple.`);

  while (cursor < line.length) {
    while (/\s/.test(line[cursor] ?? '')) cursor += 1;

    if (line[cursor] === "'") {
      cursor += 1;
      let value = '';
      let closed = false;

      while (cursor < line.length) {
        const character = line[cursor];
        if (character === '\\') {
          cursor += 1;
          if (cursor >= line.length) throw new Error(`Line ${lineNumber}: unterminated MySQL escape.`);
          value += decodeMysqlEscape(line[cursor]);
          cursor += 1;
          continue;
        }
        if (character === "'") {
          // MySQL also accepts doubled quotes inside a string.
          if (line[cursor + 1] === "'") {
            value += "'";
            cursor += 2;
            continue;
          }
          cursor += 1;
          closed = true;
          break;
        }
        value += character;
        cursor += 1;
      }

      if (!closed) throw new Error(`Line ${lineNumber}: unterminated quoted value.`);
      values.push(value);
    } else {
      const start = cursor;
      while (cursor < line.length && line[cursor] !== ',' && line[cursor] !== ')') cursor += 1;
      const raw = line.slice(start, cursor).trim();
      if (raw.toUpperCase() === 'NULL') values.push(null);
      else if (/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(raw)) values.push(Number(raw));
      else throw new Error(`Line ${lineNumber}: unsupported unquoted literal ${JSON.stringify(raw)}.`);
    }

    while (/\s/.test(line[cursor] ?? '')) cursor += 1;
    if (line[cursor] === ',') {
      cursor += 1;
      continue;
    }
    if (line[cursor] === ')') return values;
    throw new Error(`Line ${lineNumber}: expected comma or closing parenthesis at column ${cursor + 1}.`);
  }

  throw new Error(`Line ${lineNumber}: tuple did not close.`);
}

function stringValue(row: LegacyPromptRow, key: LegacyPromptColumn): string {
  const value = row[key];
  return value === null ? '' : String(value);
}

export function legacyNumber(row: LegacyPromptRow, key: LegacyPromptColumn, fallback = 0): number {
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : fallback;
}

export function legacyString(row: LegacyPromptRow, key: LegacyPromptColumn): string {
  return stringValue(row, key).trim();
}

export function legacySuggestions(row: LegacyPromptRow): string[] {
  const raw = stringValue(row, 'suggestions').trim();
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
    throw new Error(`Line ${row.sourceLine}: suggestions is not a string array.`);
  }
  return parsed.map((item) => item.trim()).filter(Boolean);
}

/** Only fields which survive, or meaningfully steer, the Freelee import. */
function targetProjection(row: LegacyPromptRow): Record<string, unknown> {
  return {
    name: legacyString(row, 'name').toLocaleLowerCase('en'),
    slug: legacyString(row, 'slug').toLocaleLowerCase('en'),
    status: legacyNumber(row, 'status'),
    description: stringValue(row, 'description'),
    welcomeMessage: stringValue(row, 'welcome_message'),
    expertise: stringValue(row, 'expert'),
    prompt: stringValue(row, 'prompt'),
    suggestions: legacySuggestions(row),
    temperature: legacyNumber(row, 'temperature'),
    frequencyPenalty: legacyNumber(row, 'frequency_penalty'),
    presencePenalty: legacyNumber(row, 'presence_penalty'),
    historyMessages: legacyNumber(row, 'array_message_history'),
    capabilities: legacyCapabilities(row),
  };
}

function projectionHash(row: LegacyPromptRow): string {
  return createHash('sha256').update(JSON.stringify(targetProjection(row))).digest('hex');
}

export function parseLegacyPromptDump(source: string): LegacyParseResult {
  const rows: LegacyPromptRow[] = [];
  let block = 0;
  let activeColumns: readonly string[] | null = null;

  for (const [index, rawLine] of source.split(/\r?\n/).entries()) {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line) continue;

    if (/^INSERT\s+INTO\s+`prompts`/i.test(line)) {
      const match = line.match(/^INSERT\s+INTO\s+`prompts`\s*\((.*?)\)\s*VALUES\s*$/i);
      if (!match) throw new Error(`Line ${lineNumber}: unsupported INSERT header.`);
      activeColumns = [...match[1].matchAll(/`([^`]+)`/g)].map((item) => item[1]);
      if (activeColumns.join('\0') !== LEGACY_PROMPT_COLUMNS.join('\0')) {
        throw new Error(`Line ${lineNumber}: prompts column list does not match the expected 49-column export.`);
      }
      block += 1;
      continue;
    }

    if (line.startsWith('(')) {
      if (!activeColumns) throw new Error(`Line ${lineNumber}: tuple appears before an INSERT header.`);
      const values = parseTuple(line, lineNumber);
      if (values.length !== LEGACY_PROMPT_COLUMNS.length) {
        throw new Error(`Line ${lineNumber}: expected ${LEGACY_PROMPT_COLUMNS.length} values, got ${values.length}.`);
      }
      const row = Object.fromEntries(LEGACY_PROMPT_COLUMNS.map((column, i) => [column, values[i]])) as Record<LegacyPromptColumn, LegacyValue>;
      rows.push({ ...row, sourceBlock: block, sourceLine: lineNumber });
      continue;
    }

    throw new Error(`Line ${lineNumber}: unexpected content outside a prompts INSERT.`);
  }

  if (block === 0 || rows.length === 0) throw new Error('No prompts INSERT rows were found.');

  const bySlug = new Map<string, LegacyPromptCharacter>();
  for (const row of rows) {
    const name = legacyString(row, 'name');
    const slug = legacyString(row, 'slug');
    const prompt = legacyString(row, 'prompt');
    if (!name || !slug || !prompt) throw new Error(`Line ${row.sourceLine}: name, slug and prompt are required.`);

    const ref = { block: row.sourceBlock, line: row.sourceLine, id: legacyNumber(row, 'id') };
    const existing = bySlug.get(slug.toLocaleLowerCase('en'));
    if (!existing) {
      bySlug.set(slug.toLocaleLowerCase('en'), {
        ...row,
        sourceRefs: [ref],
        sourceKey: `legacy-prompts:${slug.toLocaleLowerCase('en')}`,
      });
      continue;
    }
    if (projectionHash(existing) !== projectionHash(row)) {
      throw new Error(`Lines ${existing.sourceLine} and ${row.sourceLine}: duplicate slug ${slug} has different target content.`);
    }
    existing.sourceRefs.push(ref);
  }

  const characters = [...bySlug.values()];
  return {
    rows,
    characters,
    duplicateGroups: characters
      .filter((character) => character.sourceRefs.length > 1)
      .map((character) => ({ sourceKey: character.sourceKey, refs: character.sourceRefs })),
    insertBlocks: block,
    sourceSha256: createHash('sha256').update(source).digest('hex'),
  };
}

export function legacyCapabilities(row: LegacyPromptRow): PersonaCapabilities {
  const enabled = (key: LegacyPromptColumn) => legacyNumber(row, key) === 1;
  return {
    vision: enabled('use_vision'),
    images: enabled('use_dalle'),
    voiceIn: enabled('display_mic') || enabled('use_mic_whisper'),
    voiceOut: enabled('use_google_voice') || enabled('use_cloud_google_voice') || enabled('display_mp3_google_cloud_text'),
    share: enabled('display_share'),
    copy: enabled('display_copy_btn'),
    embed: enabled('allow_embed_chat'),
    suggestions: enabled('display_suggestions'),
    badwordFilter: enabled('filter_badwords'),
    tone: enabled('display_prompts_tone'),
    writing: enabled('display_prompts_writing'),
    output: enabled('display_prompts_output'),
  };
}

/** Compact, explicit input for the architect model; old UI-only fields stay out. */
export function legacyCharacterDocument(row: LegacyPromptCharacter): string {
  return JSON.stringify({
    sourceName: legacyString(row, 'name'),
    sourceSlug: legacyString(row, 'slug'),
    expertise: legacyString(row, 'expert'),
    description: legacyString(row, 'description'),
    welcomeMessage: legacyString(row, 'welcome_message'),
    systemPrompt: legacyString(row, 'prompt'),
    suggestions: legacySuggestions(row),
    sourceCapabilities: legacyCapabilities(row),
  }, null, 2);
}
