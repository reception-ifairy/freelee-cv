'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import type { BlockField, LeafBlockField } from '@/lib/blocks/catalog';
import { BLOCK_ICON_KEYS } from '@/lib/blocks/catalog';
import { Input, Textarea, Label, Hint, Checkbox } from '@/components/ui/field';
import { GridSelect } from '@/components/ui/grid-select';
import { HelpTip } from '@/components/ui/help-tip';
import { BlockIcon } from '@/components/ui/block-icon';
import { cn } from '@/lib/utils';

/**
 * Renders a block's editing UI from its declared field schema.
 *
 * This is what makes adding a block type a two-file change. Before this, every
 * editable section had a hand-written form — four types took 159 lines and each
 * new type meant another one. `SETTINGS_SCHEMA` proved the pattern here first:
 * declare fields as data, render them generically, and "adding an option is a
 * one-line change — no new page, no new migration, no new action".
 *
 * State is held as a single config object and submitted as one JSON payload,
 * rather than as individual named inputs, because repeaters have no fixed
 * field names — `steps[2].title` only exists once someone adds a third step.
 */

type Config = Record<string, unknown>;

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function FieldLabel({ field, htmlFor }: { field: { label: string; help?: string }; htmlFor?: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <Label htmlFor={htmlFor} className="mb-0">
        {field.label}
      </Label>
      {field.help ? <HelpTip title={field.label} body={field.help} /> : null}
    </div>
  );
}

/** One non-repeater field. Split out so the repeater can reuse it for its sub-fields. */
function LeafField({
  field,
  value,
  onChange,
  idPrefix,
}: {
  field: LeafBlockField;
  value: unknown;
  onChange: (next: unknown) => void;
  idPrefix: string;
}) {
  const id = `${idPrefix}-${field.key}`;

  switch (field.type) {
    case 'textarea':
    case 'markdown':
      return (
        <div>
          <FieldLabel field={field} htmlFor={id} />
          <Textarea
            id={id}
            value={asString(value)}
            rows={field.type === 'markdown' ? 8 : 3}
            onChange={(e) => onChange(e.target.value)}
            className={field.type === 'markdown' ? 'font-mono text-xs' : undefined}
          />
        </div>
      );

    case 'toggle':
      return (
        <label className="flex items-center gap-2.5">
          <Checkbox checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
          <span className="text-sm text-slate-700 dark:text-slate-300">{field.label}</span>
          {field.help ? <HelpTip title={field.label} body={field.help} /> : null}
        </label>
      );

    case 'number':
      return (
        <div>
          <FieldLabel field={field} htmlFor={id} />
          <Input
            id={id}
            type="number"
            min={field.min}
            max={field.max}
            value={asString(value)}
            // Kept as a raw string until it is a real number: `Number('')` is 0
            // and `Number.isFinite(0)` is true, which is exactly how unset
            // dropdowns once stored a bogus id of 0 elsewhere in this admin.
            onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          />
        </div>
      );

    case 'select':
      return (
        <div>
          <FieldLabel field={field} htmlFor={id} />
          <GridSelect
            id={id}
            options={field.options}
            value={asString(value)}
            onChange={onChange}
            columns={field.columns ?? 3}
          />
        </div>
      );

    case 'icon':
      return (
        <div>
          <FieldLabel field={field} />
          <div className="flex flex-wrap gap-1.5">
            {BLOCK_ICON_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onChange(key)}
                aria-label={key}
                aria-pressed={value === key}
                className={cn(
                  'grid size-9 place-items-center rounded-lg border transition',
                  value === key
                    ? 'border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800',
                )}
              >
                <BlockIcon name={key} className="size-4" />
              </button>
            ))}
          </div>
        </div>
      );

    case 'image':
    case 'link':
    case 'text':
    default:
      return (
        <div>
          <FieldLabel field={field} htmlFor={id} />
          <Input
            id={id}
            value={asString(value)}
            placeholder={'placeholder' in field ? field.placeholder : undefined}
            onChange={(e) => onChange(e.target.value)}
          />
          {field.type === 'image' && asString(value) ? (
            // eslint-disable-next-line @next/next/no-img-element -- an admin preview of an arbitrary URL, not a site asset
            <img src={asString(value)} alt="" className="mt-2 h-20 rounded-lg border border-slate-200 object-cover dark:border-slate-700" />
          ) : null}
        </div>
      );
  }
}

/** A list of same-shaped items — steps, FAQ entries, testimonials, stats, logos. */
function RepeaterField({
  field,
  value,
  onChange,
  idPrefix,
}: {
  field: Extract<BlockField, { type: 'repeater' }>;
  value: unknown;
  onChange: (next: unknown) => void;
  idPrefix: string;
}) {
  const items: Config[] = Array.isArray(value) ? (value as Config[]) : [];
  const [open, setOpen] = useState<number | null>(0);

  const min = field.min ?? 0;
  const max = field.max ?? 12;

  function update(index: number, next: Config) {
    onChange(items.map((item, i) => (i === index ? next : item)));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
    setOpen(target);
  }

  function add() {
    // Seed a new item from its sub-fields so nothing is `undefined` on first render.
    const blank: Config = {};
    for (const sub of field.fields) blank[sub.key] = sub.type === 'toggle' ? false : sub.type === 'icon' ? 'sparkles' : '';
    onChange([...items, blank]);
    setOpen(items.length);
  }

  return (
    <div>
      <FieldLabel field={field} />
      <div className="space-y-2">
        {items.map((item, index) => {
          const isOpen = open === index;
          const title = asString(item.title || item.label || item.question || item.name) || `${field.itemLabel} ${index + 1}`;

          return (
            <div key={index} className="rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 px-3 py-2">
                <GripVertical className="size-4 shrink-0 text-slate-300 dark:text-slate-600" />
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : index)}
                  className="flex-1 truncate text-left text-sm font-medium"
                  aria-expanded={isOpen}
                >
                  {title}
                </button>
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up" className="text-slate-400 disabled:opacity-30">
                  <ChevronUp className="size-4" />
                </button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label="Move down" className="text-slate-400 disabled:opacity-30">
                  <ChevronDown className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onChange(items.filter((_, i) => i !== index))}
                  disabled={items.length <= min}
                  aria-label={`Remove ${field.itemLabel.toLowerCase()}`}
                  title={items.length <= min ? `At least ${min} required` : undefined}
                  className="text-rose-400 hover:text-rose-600 disabled:opacity-30"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              {isOpen ? (
                <div className="space-y-3 border-t border-slate-100 p-3 dark:border-slate-800">
                  {field.fields.map((sub) => (
                    <LeafField
                      key={sub.key}
                      field={sub}
                      value={item[sub.key]}
                      onChange={(next) => update(index, { ...item, [sub.key]: next })}
                      idPrefix={`${idPrefix}-${field.key}-${index}`}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={add}
        disabled={items.length >= max}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Plus className="size-3.5" /> Add {field.itemLabel.toLowerCase()}
        {items.length >= max ? ` (max ${max})` : ''}
      </button>
    </div>
  );
}

export function BlockFields({
  fields,
  config,
  onChange,
  idPrefix,
}: {
  fields: BlockField[];
  config: Config;
  onChange: (next: Config) => void;
  idPrefix: string;
}) {
  if (fields.length === 0) {
    return (
      <p className="text-xs text-slate-400">
        This block builds itself from data you manage elsewhere — there is nothing to write here, only
        layout to set.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {fields.map((field) =>
        field.type === 'repeater' ? (
          <RepeaterField
            key={field.key}
            field={field}
            value={config[field.key]}
            onChange={(next) => onChange({ ...config, [field.key]: next })}
            idPrefix={idPrefix}
          />
        ) : (
          <LeafField
            key={field.key}
            field={field}
            value={config[field.key]}
            onChange={(next) => onChange({ ...config, [field.key]: next })}
            idPrefix={idPrefix}
          />
        ),
      )}
    </div>
  );
}
