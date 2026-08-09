import 'server-only';
import type { ReactNode } from 'react';
import { renderSection } from '@/components/site/sections';
import { withDefaults } from './catalog';
import { resolveLayout, type BlockLayout } from './layout';
import { blockMeta } from './catalog';

/**
 * The server half of the block system. The catalog (`catalog.ts`) is a plain
 * module holding metadata both the admin and the site read; this file holds the
 * rendering, imports the database-touching section components, and is therefore
 * `server-only`.
 *
 * Keeping them apart is not ceremony — importing a server-only registry into a
 * client component has broken the build twice on this project (the AI provider
 * registry, then the tools registry). The rule that works: **constants in one
 * file, implementations in another, joined on `key`.**
 */

export type BlockRow = {
  id: number;
  type: string;
  config: unknown;
  layout: unknown;
  isVisible: boolean;
};

/** The layout a block should render with: its own defaults, overridden by whatever the admin saved. */
export function layoutFor(type: string, stored: unknown): BlockLayout {
  const meta = blockMeta(type);
  return resolveLayout({ ...(meta?.defaultLayout ?? {}), ...((stored ?? {}) as object) });
}

/**
 * Renders one block's inner content — no layout band. Returns `null` for an
 * unrecognised type so a stale row in the database can never break the page,
 * the same fail-open posture as knowledge sources and translations.
 */
export async function renderBlockContent(type: string, config: unknown): Promise<ReactNode> {
  return renderSection(type, withDefaults(type, config));
}
