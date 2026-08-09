import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { pageSections } from '@/db/schema';
import { currentUser } from '@/lib/auth';
import { BlockRenderer } from '@/components/site/block-renderer';
import { EditorStudio } from '@/components/site/editor-studio';
import type { EditableBlock } from '@/components/site/editor-types';

// No `revalidate` here: the site header reads the session cookie, so this route
// has always rendered on demand (`ƒ` in the build output). The 300s value that
// used to sit here never applied — and now that admins receive editing chrome,
// caching this page would be actively wrong.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [rows, user] = await Promise.all([
    db
      .select()
      .from(pageSections)
      .where(and(eq(pageSections.page, 'home'), isNull(pageSections.pageId), isNull(pageSections.postId)))
      .orderBy(asc(pageSections.position)),
    currentUser(),
  ]);

  const canEdit = user?.isAdmin === true;
  const scope = { page: 'home' };

  const editable: EditableBlock[] = rows
    .filter((row) => row.parentId == null)
    .map((row) => ({
      id: row.id,
      type: row.type,
      isVisible: row.isVisible,
      config: (row.config ?? {}) as Record<string, unknown>,
      layout: row.layout,
      parentId: row.parentId ?? null,
    }));

  // Children of a columns container are fetched too — BlockRenderer partitions
  // them so a container draws its own children and they are not also rendered
  // at the top level.
  return (
    <>
      <BlockRenderer rows={rows} canEdit={canEdit} scope={scope} />
      {canEdit ? <EditorStudio blocks={editable} scope={scope} adminHref="/admin/frontpage" /> : null}
    </>
  );
}
