/**
 * Turns the flat `menu_items` rows into one level of parents and children.
 *
 * Plain module — the header (server) and the admin editor (client) both use it,
 * so the shapes cannot drift apart.
 *
 * Visibility is applied **before** nesting, and a parent whose children are all
 * hidden keeps rendering as a plain link rather than an empty dropdown.
 */

export type MenuRow = {
  id: number;
  label: string;
  href: string;
  visibleTo: 'all' | 'guest' | 'auth' | 'admin';
  openInNewTab: boolean;
  isActive: boolean;
  position: number;
  parentId: number | null;
  icon: string | null;
  description: string | null;
};

export type MenuNode = MenuRow & { children: MenuRow[] };

export type Viewer = { signedIn: boolean; isAdmin: boolean };

export function isVisibleTo(row: Pick<MenuRow, 'visibleTo' | 'isActive'>, viewer: Viewer): boolean {
  if (!row.isActive) return false;
  if (row.visibleTo === 'guest') return !viewer.signedIn;
  if (row.visibleTo === 'auth') return viewer.signedIn;
  if (row.visibleTo === 'admin') return viewer.isAdmin;
  return true;
}

export function buildMenuTree(rows: MenuRow[], viewer: Viewer): MenuNode[] {
  const allowed = rows.filter((row) => isVisibleTo(row, viewer));
  const byId = new Set(allowed.map((row) => row.id));

  const parents = allowed
    .filter((row) => row.parentId === null)
    .sort((a, b) => a.position - b.position);

  const childrenOf = new Map<number, MenuRow[]>();
  for (const row of allowed) {
    // An orphan — its parent is hidden or gone — is dropped rather than
    // promoted to the top level, where it would appear out of nowhere.
    if (row.parentId === null || !byId.has(row.parentId)) continue;
    childrenOf.set(row.parentId, [...(childrenOf.get(row.parentId) ?? []), row]);
  }

  return parents.map((parent) => ({
    ...parent,
    children: (childrenOf.get(parent.id) ?? []).sort((a, b) => a.position - b.position),
  }));
}
