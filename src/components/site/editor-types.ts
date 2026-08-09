/**
 * Shared between the on-page editor's client components and the server
 * components that mount them. Plain module — no 'use client', no 'server-only'.
 */

export type EditScope = { page: string; pageId?: number; postId?: number };

export type EditableBlock = {
  id: number;
  type: string;
  isVisible: boolean;
  config: Record<string, unknown>;
  layout: unknown;
  parentId: number | null;
};

/** Attribute the studio uses to scroll a block into view, and CSS uses to outline it. */
export const BLOCK_ANCHOR_ATTR = 'data-block-id';
