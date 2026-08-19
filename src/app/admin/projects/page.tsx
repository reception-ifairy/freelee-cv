import type { Metadata } from 'next';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { projects, chats, conversations, creditTransactions } from '@/db/schema';
import { crews } from '@/modules/crews/schema';
import { PageHeader } from '@/components/admin/page-header';
import { InlineForm } from '@/components/admin/inline-form';
import { Input, Textarea, Select, Label, Hint } from '@/components/ui/field';
import { getAdminView } from '@/lib/admin/view-preference-server';
import { saveProjectAction } from '@/server/actions/admin-projects';
import { ProjectsList, type ProjectRowData } from './projects-list';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Projects' };

export default async function AdminProjectsPage() {
  const [rows, view] = await Promise.all([
    // Counts and spend as correlated subqueries rather than four LEFT JOINs:
    // joining three one-to-many tables at once multiplies the rows and every
    // count comes back wrong. That exact bug has bitten this admin twice
    // (/admin/packs 500, /admin/customers reporting 0 chats for everyone).
    db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        description: projects.description,
        colour: projects.colour,
        status: projects.status,
        budgetCredits: projects.budgetCredits,
      // `sql.raw('"projects"."id"')`, not `${projects.id}`.
        //
        // Drizzle emits a bare `"id"` for the FROM-table's own column inside a
        // `sql` template, and inside a correlated subquery Postgres resolves
        // that against the INNER table — so `WHERE project_id = "id"` silently
        // compared each chat to its own id (always false), and the credits one
        // crashed outright with `text = bigint`.
        //
        // This is the third time this exact bug has appeared here: /admin/packs
        // 500'd on it and /admin/customers reported 0 chats for every customer
        // because text = text failed silently. Qualifying explicitly is the fix.
        chats: sql<number>`(select count(*)::int from ${chats} where ${chats.projectId} = ${sql.raw('"projects"."id"')})`,
        rooms: sql<number>`(select count(*)::int from ${conversations} where ${conversations.projectId} = ${sql.raw('"projects"."id"')})`,
        crews: sql<number>`(select count(*)::int from ${crews} where ${crews.projectId} = ${sql.raw('"projects"."id"')})`,
        spent: sql<number>`(select coalesce(sum(abs(${creditTransactions.amount})), 0)::int
                            from ${creditTransactions}
                            where ${creditTransactions.type} = 'spend'
                              and ${creditTransactions.meta}->>'projectId' = ${sql.raw('"projects"."id"')})`,
      })
      .from(projects)
      .orderBy(desc(projects.updatedAt)),
    getAdminView('projects'),
  ]);

  return (
    <div>
      <PageHeader
        title="Projects"
        description="A project groups the chats, rooms and bot teams that belong to one piece of work — and tracks what it has cost."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ProjectsList rows={rows as ProjectRowData[]} view={view} />
        </div>

        <InlineForm action={saveProjectAction} title="New project" submitLabel="Create project">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" required placeholder="e.g. Website refresh" />
          </div>
          <div>
            <Label htmlFor="description">What is it for?</Label>
            <Textarea id="description" name="description" rows={3} />
          </div>
          <div>
            <Label htmlFor="colour">Colour</Label>
            <Input id="colour" name="colour" type="color" defaultValue="#6366f1" className="h-10 p-1" />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select id="status" name="status" defaultValue="active">
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="done">Done</option>
              <option value="archived">Archived</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="budgetCredits">Budget (credits)</Label>
            <Input id="budgetCredits" name="budgetCredits" type="number" min={0} placeholder="Leave blank for no cap" />
            <Hint>
              Checked before a bot team run starts, and reported here — <strong>not</strong> a hard limit
              at spend time. The wallet credits are drawn from is shared by the whole team.
            </Hint>
          </div>
        </InlineForm>
      </div>
    </div>
  );
}
