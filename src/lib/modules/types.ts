/**
 * The Next.js-native equivalent of the mined concept doc's Laravel package
 * manifest (`app-modules/<key>/module.json`). A ModuleManifest is a
 * compile-time object, not something scanned off disk at runtime — see
 * docs/08-module-architecture.md for why App Router rules that out.
 */
export type ModuleType = 'core' | 'feature' | 'admin' | 'integration';

export type ModuleManifest = {
  key: string;
  name: string;
  version: string;
  description: string;
  type: ModuleType;
  /** Core modules are always enabled and cannot be disabled per team. */
  isCore: boolean;

  requires: {
    /** Other module keys this one depends on — checked by scripts/verify-module-graph.ts. */
    modules?: string[];
    /** Capabilities (from other modules' `provides.capabilities`) this one consumes. */
    capabilities?: string[];
  };
  provides: {
    capabilities?: string[];
    events?: string[];
  };

  /** Permission strings this module registers — see src/lib/auth/permissions.ts (Phase 2). */
  permissions?: string[];

  /**
   * Per-team configurable settings, stored in `moduleTeam.settings` (jsonb).
   * Informational/documentation only — there's no generic settings-form
   * renderer yet (unlike src/lib/settings-schema.ts's SETTINGS_SCHEMA for
   * platform-wide settings); a module reads its own keys out of
   * `moduleTeam.settings` directly with its own defaults. Added Phase 6 —
   * the first module that actually needs one.
   */
  settingsSchema?: Record<string, { type: 'number' | 'boolean' | 'string'; default: unknown; description: string }>;

  navigation?: {
    label: string;
    href: string;
    group: string;
    order: number;
    /** Required permission to see this nav entry; omit if visible to any team member. */
    permission?: string;
  }[];
};
