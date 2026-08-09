import 'server-only';
import { cookies } from 'next/headers';
import { VIEW_COOKIE_PREFIX, type AdminView } from './view-preference';

/**
 * Reads the saved grid/list preference while rendering on the server.
 *
 * A cookie rather than localStorage precisely so this is possible: with
 * localStorage the server would always emit the grid and the client would swap
 * to the list after hydrating, a visible flash on every page load for anyone
 * who prefers the table.
 */
export async function getAdminView(module: string, fallback: AdminView = 'grid'): Promise<AdminView> {
  const store = await cookies();
  const value = store.get(`${VIEW_COOKIE_PREFIX}${module}`)?.value;
  return value === 'list' || value === 'grid' ? value : fallback;
}
