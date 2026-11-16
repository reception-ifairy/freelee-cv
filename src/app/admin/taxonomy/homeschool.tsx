import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { StatTile } from '@/components/ui/stat-tile';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { CHILD_KEY_STAGES, type Coverage } from '@/lib/curriculum/coverage';
import type { CurriculumStatus, HubTutor } from '@/lib/curriculum/hub-queries';
import { subjectLabel, type SubjectOption } from '@/lib/curriculum/subjects';
import type { FamilyCounts } from '@/lib/children/admin-counts';
import { relativeTime } from '@/lib/utils';

/**
 * The homeschool hub's tabs (owner, 2026-11-14: "homeschooling is starting to
 * look like a maze"). Everything a homeschooling admin question needs, in one
 * market: who teaches (Tutors), what they teach against (Curriculum), and how
 * many families use it (Families — numbers only, never a child's data).
 */

/** The page's promise against the tutors who can keep it — shown on every hub tab. */
export function PromiseBanner({ liveTutors, page }: { liveTutors: number; page: { slug: string; published: boolean } | null }) {
  if (liveTutors > 0) {
    return (
      <p className="mb-6 rounded-control border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
        {liveTutors} {liveTutors === 1 ? 'tutor is' : 'tutors are'} live, so children can have lessons.
        {page?.published ? ` If /${page.slug} still says tutors are “in preparation”, its copy is now out of date.` : ''}
      </p>
    );
  }
  return (
    <p className="mb-6 rounded-control border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
      <strong>No tutor is live.</strong>{' '}
      {page?.published
        ? `/${page.slug} is published and says tutors are in preparation. Keep it so until the first tutor goes live; then its copy needs changing.`
        : 'There is no published offering page either.'}
    </p>
  );
}

export function TutorsTab({ tutors, options }: { tutors: HubTutor[]; options: SubjectOption[] }) {
  const live = tutors.filter((t) => t.isActive).length;
  return (
    <section>
      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
        A tutor is a bot with a <strong>curriculum scope</strong> — the key stages and subjects it teaches. Give a bot one in its editor,
        under Curriculum. {tutors.length} {tutors.length === 1 ? 'tutor' : 'tutors'}, {live} live.
      </p>
      {tutors.length ? (
        <Card className="overflow-hidden">
          <Table>
            <THead>
              <tr>
                <TH className="px-3 py-2">Tutor</TH>
                <TH className="px-3 py-2">Key stages</TH>
                <TH className="px-3 py-2">Subjects</TH>
                <TH className="px-3 py-2">Messages</TH>
                <TH className="px-3 py-2">Status</TH>
                <TH className="px-3 py-2" />
              </tr>
            </THead>
            <TBody>
              {tutors.map((t) => (
                <TR key={t.id}>
                  <TD className="px-3 py-2">
                    <Link href={`/admin/taxonomy?cat=education-and-training&tab=tutors&open=persona-${t.id}`} className="font-medium hover:text-brand-400">
                      {t.name}
                    </Link>
                    <span className="block text-xs text-slate-500">{[t.categoryName, t.sectorName].filter(Boolean).join(' › ') || 'not filed'}</span>
                  </TD>
                  <TD className="px-3 py-2 font-mono text-xs">{t.keyStages.join(' ') || '—'}</TD>
                  <TD className="px-3 py-2 text-xs">{t.subjects.map((s) => subjectLabel(s, options)).join(', ') || '—'}</TD>
                  <TD className="px-3 py-2 font-mono text-xs">{t.messagesCount.toLocaleString('en-GB')}</TD>
                  <TD className="px-3 py-2">{t.isActive ? <Badge tone="green">Live</Badge> : <Badge tone="slate">Not live</Badge>}</TD>
                  <TD className="px-3 py-2 text-right">
                    <Link href={`/admin/personas/${t.id}`} aria-label={`Edit ${t.name}`} className="inline-grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-slate-200">
                      <Pencil className="size-4" />
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      ) : (
        <Card padding="md">
          <p className="text-sm text-slate-500">No tutor yet.</p>
        </Card>
      )}
    </section>
  );
}

const date = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} (${relativeTime(d)})`;
};

const TEST_TONE: Record<string, string> = { ok: 'text-emerald-300', 'no-key': 'text-slate-400' };

export function CurriculumTab({ status, coverage, tutors }: { status: CurriculumStatus; coverage: Coverage; tutors: HubTutor[] }) {
  const nameOf = new Map(tutors.map((t) => [t.id, `${t.name}${t.isActive ? '' : ' (not live)'}`]));
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="eyebrow">What freelee holds from the curriculum</h2>
          <Link href="/admin/connections#conn-curriculum" className="text-xs font-semibold text-brand-400 hover:underline">
            Manage the connection →
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card padding="md">
            <p className="eyebrow mb-2">Connection</p>
            <p className="text-sm">{status.configured ? 'Key saved' : <span className="text-amber-300">No key</span>}</p>
            {status.lastTest ? (
              <p className={`mt-1 text-xs ${TEST_TONE[status.lastTest.state] ?? 'text-amber-300'}`}>
                Last test: {status.lastTest.state === 'ok' ? 'working' : status.lastTest.message} · {relativeTime(status.lastTest.at)}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">Never tested.</p>
            )}
          </Card>
          <Card padding="md">
            <p className="eyebrow mb-2">Subjects</p>
            {status.subjects ? (
              <>
                <p className="text-sm">{status.subjects.options} subjects, {status.subjects.parts} of them parts of another</p>
                <p className="mt-1 text-xs text-slate-500">Version {status.subjects.version} · fetched {date(status.subjects.fetchedAt)}</p>
              </>
            ) : (
              <p className="text-sm text-slate-500">Not fetched — the built-in list is used.</p>
            )}
          </Card>
          <Card padding="md">
            <p className="eyebrow mb-2">Exams</p>
            {status.exams ? (
              <>
                <p className="text-sm">{status.exams.total} exams, {status.exams.verified} checked at the source</p>
                <p className="mt-1 text-xs text-slate-500">
                  {Object.entries(status.exams.byFamily).map(([f, n]) => `${n} ${f}`).join(' · ')}
                </p>
                <p className="mt-1 text-xs text-slate-500">Version {status.exams.version} · fetched {date(status.exams.fetchedAt)}</p>
              </>
            ) : (
              <p className="text-sm text-slate-500">Not fetched — parents cannot choose a target exam yet.</p>
            )}
          </Card>
          <Card padding="md">
            <p className="eyebrow mb-2">Scope</p>
            {status.scope ? (
              <>
                <p className="text-sm">
                  {status.scope.keyStages.reduce((n, k) => n + k.objectives, 0).toLocaleString('en-GB')} objectives across {status.scope.keyStages.length} key stages
                </p>
                <p className="mt-1 font-mono text-[11px] text-slate-500">
                  {status.scope.keyStages.map((k) => `${k.keyStage} ${k.objectives.toLocaleString('en-GB')}`).join(' · ')}
                </p>
                <p className="mt-1 text-xs text-slate-500">Fetched {date(status.scope.fetchedAt)}</p>
              </>
            ) : (
              <p className="text-sm text-slate-500">Not fetched.</p>
            )}
          </Card>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Who teaches what</h2>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          Each subject a parent can choose, at each key stage it is taught in. A cell counts the tutors who would teach it — live/all — by
          the same rule lessons use: the key stage is in the tutor’s scope and the subject is the same or part of the same whole (a science
          tutor teaches biology). <strong>{coverage.coveredLive}</strong> of {coverage.offered} have a live tutor
          {coverage.coveredAny > coverage.coveredLive ? `, ${coverage.coveredAny} with any tutor` : ''}.
        </p>
        <Card className="overflow-hidden">
          <Table>
            <THead>
              <tr>
                <TH className="px-3 py-2">Subject</TH>
                {CHILD_KEY_STAGES.map((ks) => (
                  <TH key={ks} className="px-3 py-2 text-center">{ks}</TH>
                ))}
              </tr>
            </THead>
            <TBody>
              {coverage.rows.map((row) => (
                <TR key={row.option.id}>
                  <TD className={`px-3 py-1.5 ${row.option.partOf ? 'pl-7 text-slate-400' : 'font-medium'}`}>
                    {row.option.label}
                    {row.option.partOf ? (
                      <span className="text-xs text-slate-600"> · part of {coverage.rows.find((r) => r.option.id === row.option.partOf)?.option.label ?? row.option.partOf}</span>
                    ) : null}
                  </TD>
                  {row.cells.map((cell) => (
                    <TD key={cell.keyStage} className="px-3 py-1.5 text-center">
                      {!cell.offered ? (
                        <span className="text-slate-700" title="Not taught at this key stage">·</span>
                      ) : (
                        <span
                          title={cell.tutorIds.length ? cell.tutorIds.map((id) => nameOf.get(id)).join(', ') : 'No tutor'}
                          className={`inline-block min-w-10 rounded px-1.5 py-0.5 font-mono text-[11px] ${
                            cell.live ? 'bg-emerald-500/15 text-emerald-300' : cell.total ? 'bg-amber-500/10 text-amber-300' : 'bg-white/[0.03] text-slate-600'
                          }`}
                        >
                          {cell.live}/{cell.total}
                        </span>
                      )}
                    </TD>
                  ))}
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
        <p className="mt-2 text-xs text-slate-500">Green: a live tutor teaches it. Amber: only tutors that are not live. Grey 0/0: nobody yet. A dot: not taught at that stage.</p>
      </section>
    </div>
  );
}

export function FamiliesTab({ counts }: { counts: FamilyCounts }) {
  const p = counts.profiles;
  return (
    <div className="space-y-6">
      <p className="rounded-control border border-slate-200 px-3 py-2 text-sm text-slate-400 dark:border-white/10">
        Numbers only. A child’s profile and plan are sealed with a key of their own, and nothing in the admin can open them — this page
        counts rows and never reads what is in them.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Child profiles" value={String(p.total)} hint={`${p.active} active · ${p.paused} paused`} />
        <StatTile label="Parents" value={String(p.parents)} hint="accounts with at least one profile" />
        <StatTile label="Active in 30 days" value={String(p.activeLast30)} hint={`${p.newLast30} new in 30 days`} />
        <StatTile label="Learning plans" value={String(counts.plans.total)} hint={`${p.retentionNotices} retention notices sent`} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Card padding="md">
          <p className="eyebrow mb-2">Plans by curriculum version</p>
          {counts.plans.byVersion.length ? (
            <ul className="space-y-1 font-mono text-xs">
              {counts.plans.byVersion.map((v) => (
                <li key={v.version} className="flex justify-between gap-3"><span>{v.version}</span><span>{v.count}</span></li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No plan yet.</p>
          )}
        </Card>
        <Card padding="md">
          <p className="eyebrow mb-2">Consents</p>
          {counts.consents.length ? (
            <ul className="space-y-1 text-xs">
              {counts.consents.map((c) => (
                <li key={c.kind} className="flex justify-between gap-3">
                  <span className="font-mono">{c.kind}</span>
                  <span className="font-mono">{c.granted} given{c.withdrawn ? ` · ${c.withdrawn} withdrawn` : ''}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">None recorded.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
