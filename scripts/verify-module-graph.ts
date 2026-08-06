/**
 * Fails loudly if any module's `requires.modules` references a key that
 * isn't registered — the Next.js-native substitute for the mined concept
 * doc's runtime `blocked` module state (App Router has no boot-time plugin
 * loader to produce that state from; this is a build-time check instead).
 * See docs/08-module-architecture.md.
 *
 *   npx tsx scripts/verify-module-graph.ts
 */
import { MODULES } from '../src/lib/modules/registry';

function main() {
  const keys = new Set(MODULES.map((m) => m.key));
  const errors: string[] = [];

  for (const module of MODULES) {
    for (const dep of module.requires.modules ?? []) {
      if (!keys.has(dep)) {
        errors.push(`Module "${module.key}" requires "${dep}", which is not registered in MODULES.`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('Module graph verification failed:\n' + errors.map((e) => `  - ${e}`).join('\n'));
    process.exit(1);
  }

  console.log(`Module graph OK — ${MODULES.length} module(s) registered, all dependencies resolve.`);
}

main();
