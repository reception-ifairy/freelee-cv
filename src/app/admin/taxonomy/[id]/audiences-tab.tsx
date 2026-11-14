'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Pencil, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/field';
import { Disclosure } from '@/components/ui/disclosure';
import { AUDIENCE_FAMILY_LABEL, AUDIENCE_SEGMENTS, familyOf } from '@/lib/persona/audience-segments';
import { PILLAR_BY_ID, pillarOfSegment } from '@/lib/taxonomy/pillars';
import { setCategoryAudienceNoteAction, setCategoryAudiencesAction } from '@/server/actions/admin-taxonomy';

const TYPES = ['B2C', 'B2B', 'B2G'] as const;
const TYPE_LABEL: Record<(typeof TYPES)[number], string> = { B2C: 'Consumers', B2B: 'Businesses', B2G: 'Public sector' };

/**
 * The field's audiences, in the workspace's Audiences tab.
 *
 * Which of the 70 groups a field serves is editorial judgement — sector
 * suitability says "sells to business", not *which* businesses — and what is
 * picked here goes into the brief a bot is designed against. Two things the
 * old picker could not show are shown now:
 *
 * - **Order decides.** A bot that names no group of its own type takes its
 *   market from the field's *first* group of that type (src/lib/taxonomy/
 *   pillars.ts), so that group is marked "decides". New picks go to the end;
 *   existing ones keep their place.
 * - **The note is editable.** Why a group matters to this field, in the
 *   operator's words, compiled into the brief — until now only a migration
 *   could write one.
 */
export function AudiencesTab({ categoryId, linked }: { categoryId: number; linked: { code: string; note: string | null }[] }) {
  const router = useRouter();
  const [choosing, setChoosing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const rows = linked.filter((l) => AUDIENCE_SEGMENTS[l.code]);
  const firstOfType = new Set(TYPES.flatMap((type) => rows.find((r) => AUDIENCE_SEGMENTS[r.code].audienceType === type)?.code ?? []));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          The groups of people this field serves, and why. They go into the brief a bot is designed against. The first group of each
          kind also <strong>decides the market</strong> of a bot here that names no group of its own.
        </p>
        <Button variant={choosing ? 'secondary' : 'primary'} onClick={() => setChoosing((v) => !v)}>
          {choosing ? 'Close the list' : 'Choose audiences'}
        </Button>
      </div>

      {choosing ? (
        <Chooser
          categoryId={categoryId}
          linked={rows.map((r) => r.code)}
          onSaved={(text) => {
            setMessage(text);
            setChoosing(false);
            router.refresh();
          }}
        />
      ) : null}
      {message ? <p className="text-xs text-slate-500">{message}</p> : null}

      {rows.length === 0 ? (
        <Card padding="md">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nobody has decided yet. Until an audience is attached, a bot designed here is designed for everyone — which usually means
            nobody.
          </p>
        </Card>
      ) : (
        TYPES.map((type) => {
          const ofType = rows.filter((r) => AUDIENCE_SEGMENTS[r.code].audienceType === type);
          if (!ofType.length) return null;
          return (
            <section key={type}>
              <h3 className="eyebrow mb-2">
                {TYPE_LABEL[type]} ({type}) · {ofType.length}
              </h3>
              <ul className="divide-y divide-slate-200 rounded-card border border-slate-200 dark:divide-white/5 dark:border-white/10">
                {ofType.map((row) => (
                  <LinkedRow key={row.code} categoryId={categoryId} code={row.code} note={row.note} decides={firstOfType.has(row.code)} />
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

function LinkedRow({ categoryId, code, note, decides }: { categoryId: number; code: string; note: string | null; decides: boolean }) {
  const router = useRouter();
  const segment = AUDIENCE_SEGMENTS[code];
  const pillar = pillarOfSegment(code);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await setCategoryAudienceNoteAction(categoryId, code, draft);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <li className="px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {pillar ? (
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: PILLAR_BY_ID[pillar].color }}
            title={PILLAR_BY_ID[pillar].label}
          />
        ) : null}
        <Link href={`/admin/taxonomy/audiences?open=${code}`} className="font-medium hover:text-brand-400">
          {segment.name}
        </Link>
        <span className="font-mono text-[11px] text-slate-500">{code}</span>
        {pillar ? <span className="text-[11px] text-slate-500">· {PILLAR_BY_ID[pillar].label}</span> : null}
        {decides ? (
          <Badge tone="brand" title="The first group of its kind here: a bot in this field that names none of its own takes its market from it">
            decides
          </Badge>
        ) : null}
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-white/5 hover:text-slate-200"
          >
            <Pencil className="size-3" /> {note ? 'Edit note' : 'Add note'}
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={500}
            rows={2}
            autoFocus
            aria-label={`Why ${segment.name} matters to this field`}
            placeholder={`Why ${segment.name} matter to this field — it goes into the brief.`}
            className="w-full rounded-control border border-slate-200 bg-white p-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none dark:border-white/10 dark:bg-white/[0.03]"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setDraft(note ?? '');
                setEditing(false);
              }
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
            }}
          />
          <div className="flex items-center gap-2">
            <Button size="sm" loading={pending} onClick={save}>
              Save note
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(note ?? '');
                setEditing(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <span className="ml-auto font-mono text-[11px] text-slate-500">{draft.trim().length}/500</span>
          </div>
          {error ? <p className="text-xs text-rose-400">{error}</p> : null}
        </div>
      ) : note ? (
        <p className="mt-1 text-sm text-slate-400">{note}</p>
      ) : (
        <p className="mt-1 text-xs text-slate-600">No note yet.</p>
      )}
    </li>
  );
}

function Chooser({ categoryId, linked, onSaved }: { categoryId: number; linked: string[]; onSaved: (message: string) => void }) {
  const [codes, setCodes] = useState<Set<string>>(new Set(linked));
  const [filter, setFilter] = useState('');
  const [pending, startTransition] = useTransition();
  const term = filter.trim().toLowerCase();

  const families = new Map<string, string[]>();
  for (const code of Object.keys(AUDIENCE_SEGMENTS)) {
    const segment = AUDIENCE_SEGMENTS[code];
    if (term && !`${segment.name} ${segment.description} ${code}`.toLowerCase().includes(term)) continue;
    families.set(familyOf(code), [...(families.get(familyOf(code)) ?? []), code]);
  }

  function toggle(code: string) {
    const next = new Set(codes);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setCodes(next);
  }

  // Existing picks keep their place (the first of each kind decides a market); new ones follow in catalogue order.
  const ordered = [...linked.filter((c) => codes.has(c)), ...Object.keys(AUDIENCE_SEGMENTS).filter((c) => codes.has(c) && !linked.includes(c))];
  const added = ordered.filter((c) => !linked.includes(c)).length;
  const removed = linked.filter((c) => !codes.has(c)).length;

  return (
    <Card padding="md">
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden />
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Find a group — parents, SEND, councils…"
          aria-label="Find an audience group"
          className="h-9 w-full rounded-control border border-slate-200 bg-white pl-9 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none dark:border-white/10 dark:bg-white/[0.03]"
        />
      </div>

      <div className="max-h-[28rem] divide-y divide-slate-200 overflow-y-auto pr-1 dark:divide-white/5">
        {[...families.entries()].map(([family, members]) => {
          const picked = members.filter((c) => codes.has(c)).length;
          return (
            <Disclosure
              key={family}
              defaultOpen={Boolean(term)}
              title={AUDIENCE_FAMILY_LABEL[family] ?? family}
              meta={
                <span className="font-mono">
                  {picked}/{members.length}
                </span>
              }
            >
              <div className="grid gap-1 pb-2 pl-8 sm:grid-cols-2">
                {members.map((code) => {
                  const segment = AUDIENCE_SEGMENTS[code];
                  const pillar = pillarOfSegment(code);
                  return (
                    <label key={code} className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-sm hover:bg-white/[0.03]">
                      <Checkbox checked={codes.has(code)} onChange={() => toggle(code)} className="mt-0.5" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          {pillar ? <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: PILLAR_BY_ID[pillar].color }} /> : null}
                          {segment.name}
                        </span>
                        <span className="block text-xs text-slate-500">{segment.keyNeeds.slice(0, 3).map((n) => n.replace(/_/g, ' ')).join(', ')}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </Disclosure>
          );
        })}
        {families.size === 0 ? <p className="py-3 text-sm text-slate-500">Nothing matches “{filter.trim()}”.</p> : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          loading={pending}
          disabled={added === 0 && removed === 0}
          onClick={() =>
            startTransition(async () => {
              const result = await setCategoryAudiencesAction(categoryId, ordered);
              onSaved(result?.success ?? result?.error ?? '');
            })
          }
        >
          Save audiences
        </Button>
        <span className="text-xs text-slate-500">
          {codes.size} chosen{added ? ` · ${added} new` : ''}
          {removed ? ` · ${removed} removed` : ''}
        </span>
      </div>
    </Card>
  );
}
