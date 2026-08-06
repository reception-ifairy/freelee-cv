/**
 * Public surface of the crews module — other modules/core should import
 * from here, not reach into individual files (docs/08-module-architecture.md §1.5).
 */
export { manifest } from './manifest';
export { executeCrewRun } from './runner';
export { createCrewAction, startCrewRunAction, assertRunAccess } from './actions';
export type { Crew, CrewMember, CrewRun, CrewRunStep } from '@/db/schema';
