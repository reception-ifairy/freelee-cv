/**
 * Grid or list, remembered per admin module.
 *
 * **Plain module** — the cookie name and the type only. The `cookies()` read
 * lives in `view-preference-server.ts` because it imports `next/headers`, and
 * this file is imported by `resource-view.tsx`, which is a client component.
 *
 * That split is not hypothetical tidiness: putting them together failed the
 * build with "You're importing a module that depends on next/headers". It is
 * the third time this project has hit that boundary (the AI provider registry,
 * the tools registry, now this), and the fix is always the same — constants in
 * one file, server implementation in another.
 */

export type AdminView = 'grid' | 'list';

export const VIEW_COOKIE_PREFIX = 'adminview_';
