import {
  blockMeta, isBlockIconKey,
  type BlockField, type LeafBlockField,
} from './catalog';

/**
 * Validates a block's config against its declared field schema.
 *
 * Generic on purpose. The old frontpage editor had a hand-written zod schema
 * per section type, so adding a block type meant writing a form *and* a schema.
 * Driving both from the same field declarations is what keeps the promise that
 * a new block is two files.
 *
 * Two properties matter beyond "is it the right type":
 *
 *  1. **Unknown keys are dropped.** The result is rebuilt from the declared
 *     fields, never spread from the input, so a crafted request cannot stuff
 *     arbitrary data into the jsonb column.
 *  2. **Values are bounded.** Every string has a maximum length, so a single
 *     block cannot be used to write megabytes into the row.
 */

export type ValidationResult = { ok: true; config: Record<string, unknown> } | { ok: false; error: string };

const DEFAULT_MAX: Record<string, number> = {
  text: 200,
  link: 500,
  image: 1000,
  textarea: 600,
  markdown: 8000,
};

function validateLeaf(field: LeafBlockField, raw: unknown, path: string): { value: unknown } | { error: string } {
  switch (field.type) {
    case 'toggle':
      return { value: Boolean(raw) };

    case 'number': {
      if (raw === undefined || raw === null || raw === '') {
        return field.required ? { error: `${path} is required.` } : { value: undefined };
      }
      const n = Number(raw);
      if (!Number.isFinite(n)) return { error: `${path} must be a number.` };
      if (field.min !== undefined && n < field.min) return { error: `${path} must be at least ${field.min}.` };
      if (field.max !== undefined && n > field.max) return { error: `${path} must be at most ${field.max}.` };
      return { value: n };
    }

    case 'select': {
      const value = typeof raw === 'string' ? raw : '';
      if (!value) return field.required ? { error: `${path} is required.` } : { value: undefined };
      if (!field.options.some((o) => o.id === value)) return { error: `${path} is not one of the available options.` };
      return { value };
    }

    case 'icon': {
      if (!raw) return field.required ? { error: `${path} is required.` } : { value: undefined };
      // Falls back rather than erroring: an icon set can shrink between
      // releases, and a stale key should not make a saved block unsavable.
      return { value: isBlockIconKey(raw) ? raw : 'sparkles' };
    }

    default: {
      const asText = typeof raw === 'string' ? raw : raw == null ? '' : String(raw);
      const value = field.preserveWhitespace ? asText : asText.trim();
      if (field.required && value.trim().length === 0) return { error: `${path} is required.` };

      const max = field.maxLength ?? DEFAULT_MAX[field.type] ?? 200;
      if (value.length > max) return { error: `${path} must be ${max} characters or fewer.` };

      // A link that is neither absolute nor root-relative would render as a
      // path relative to whatever page it happens to sit on, which is never
      // what an admin means.
      if (field.type === 'link' && value && !/^(https?:\/\/|\/|mailto:|tel:|#)/i.test(value)) {
        return { error: `${path} must start with http://, https://, / or mailto:.` };
      }
      if (field.type === 'image' && value && !/^(https?:\/\/|\/)/i.test(value)) {
        return { error: `${path} must be a URL or a path starting with /.` };
      }

      return { value: value || undefined };
    }
  }
}

function validateField(field: BlockField, raw: unknown): { value: unknown } | { error: string } {
  if (field.type !== 'repeater') return validateLeaf(field, raw, field.label);

  const items = Array.isArray(raw) ? raw : [];
  const min = field.min ?? 0;
  const max = field.max ?? 12;
  if (items.length < min) return { error: `${field.label} needs at least ${min} ${field.itemLabel.toLowerCase()}.` };
  if (items.length > max) return { error: `${field.label} allows at most ${max}.` };

  const out: Record<string, unknown>[] = [];
  for (const [i, item] of items.entries()) {
    const source = (item ?? {}) as Record<string, unknown>;
    const clean: Record<string, unknown> = {};
    for (const sub of field.fields) {
      const result = validateLeaf(sub, source[sub.key], `${field.itemLabel} ${i + 1} — ${sub.label}`);
      if ('error' in result) return result;
      if (result.value !== undefined) clean[sub.key] = result.value;
    }
    out.push(clean);
  }

  return { value: out };
}

export function validateBlockConfig(type: string, raw: unknown): ValidationResult {
  const meta = blockMeta(type);
  if (!meta) return { ok: false, error: 'Unknown block type.' };

  const source = (raw ?? {}) as Record<string, unknown>;
  const config: Record<string, unknown> = {};

  for (const field of meta.fields) {
    const result = validateField(field, source[field.key]);
    if ('error' in result) return { ok: false, error: result.error };
    if (result.value !== undefined) config[field.key] = result.value;
  }

  return { ok: true, config };
}
