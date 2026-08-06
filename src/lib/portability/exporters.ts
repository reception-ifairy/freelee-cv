import { eq } from 'drizzle-orm';
import {
  teams, personas, personaVersions, crews, crewMembers,
  conversations, conversationParticipants, conversationMessages,
  chats, messages, usageEvents,
} from '@/db/schema';
import type { Exporter, PortabilityDb } from './contracts';

/**
 * `persona_versions.system_prompt` is redacted (`null` + `instructionsRedacted: true`)
 * whenever the exporting team isn't the version's authoring team — written
 * in Phase 8 against a condition that was structurally unreachable at the
 * time (every persona a team could export was necessarily its own). Phase 9
 * (marketplace) made it reachable: `installListing()`
 * (src/lib/marketplace/install.ts) sets `personaVersions.authoredByTeamId`
 * to the vendor's team on every installed persona's cloned version, so an
 * installing team can use, but never export, the vendor's actual prompt.
 * See docs/16-marketplace.md.
 */
function redactSystemPrompt(authoringTeamId: string, exportingTeamId: string): boolean {
  return authoringTeamId !== exportingTeamId;
}

const teamExporter: Exporter = {
  key: 'team',
  async exportTeam(db, teamId) {
    return db.select().from(teams).where(eq(teams.id, teamId));
  },
};

const personasExporter: Exporter = {
  key: 'personas',
  async exportTeam(db, teamId) {
    return db.select().from(personas).where(eq(personas.teamId, teamId));
  },
};

const personaVersionsExporter: Exporter = {
  key: 'personaVersions',
  async exportTeam(db, teamId) {
    const rows = await db
      .select({ version: personaVersions, personaTeamId: personas.teamId })
      .from(personaVersions)
      .innerJoin(personas, eq(personas.id, personaVersions.personaId))
      .where(eq(personas.teamId, teamId));

    return rows.map(({ version, personaTeamId }) => {
      // authoredByTeamId (Phase 9) is the true authoring team for an
      // installed persona's version; falls back to the owning persona's own
      // team for every version that predates the marketplace, or that was
      // never installed from one.
      const redacted = redactSystemPrompt(version.authoredByTeamId ?? personaTeamId, teamId);
      return {
        ...version,
        systemPrompt: redacted ? null : version.systemPrompt,
        instructionsRedacted: redacted,
      };
    });
  },
};

const crewsExporter: Exporter = {
  key: 'crews',
  async exportTeam(db, teamId) {
    return db.select().from(crews).where(eq(crews.teamId, teamId));
  },
};

const crewMembersExporter: Exporter = {
  key: 'crewMembers',
  async exportTeam(db, teamId) {
    const rows = await db
      .select({ member: crewMembers })
      .from(crewMembers)
      .innerJoin(crews, eq(crews.id, crewMembers.crewId))
      .where(eq(crews.teamId, teamId));
    return rows.map((r) => r.member);
  },
};

const conversationsExporter: Exporter = {
  key: 'conversations',
  async exportTeam(db, teamId) {
    return db.select().from(conversations).where(eq(conversations.teamId, teamId));
  },
};

const conversationParticipantsExporter: Exporter = {
  key: 'conversationParticipants',
  async exportTeam(db, teamId) {
    const rows = await db
      .select({ participant: conversationParticipants })
      .from(conversationParticipants)
      .innerJoin(conversations, eq(conversations.id, conversationParticipants.conversationId))
      .where(eq(conversations.teamId, teamId));
    return rows.map((r) => r.participant);
  },
};

const conversationMessagesExporter: Exporter = {
  key: 'conversationMessages',
  async exportTeam(db, teamId) {
    const rows = await db
      .select({ message: conversationMessages })
      .from(conversationMessages)
      .innerJoin(conversations, eq(conversations.id, conversationMessages.conversationId))
      .where(eq(conversations.teamId, teamId));
    return rows.map((r) => r.message);
  },
};

const chatsExporter: Exporter = {
  key: 'chats',
  async exportTeam(db, teamId) {
    return db.select().from(chats).where(eq(chats.teamId, teamId));
  },
};

const messagesExporter: Exporter = {
  key: 'messages',
  async exportTeam(db, teamId) {
    const rows = await db
      .select({ message: messages })
      .from(messages)
      .innerJoin(chats, eq(chats.id, messages.chatId))
      .where(eq(chats.teamId, teamId));
    return rows.map((r) => r.message);
  },
};

/**
 * Export-only — deliberately never imported (see importers.ts). Usage
 * events are the real-money-adjacent billing/audit trail; re-importing raw
 * "you were charged N credits" rows into a live ledger would let a bundle
 * fabricate financial history. `bundle.ts` also renders these into
 * `usageCsv` — the concept doc's `usage/usage.csv`, here a field on the
 * single JSON bundle rather than a second file.
 */
const usageEventsExporter: Exporter = {
  key: 'usageEvents',
  async exportTeam(db, teamId) {
    return db.select().from(usageEvents).where(eq(usageEvents.teamId, teamId));
  },
};

export const EXPORTERS: Exporter[] = [
  teamExporter, personasExporter, personaVersionsExporter, crewsExporter, crewMembersExporter,
  conversationsExporter, conversationParticipantsExporter, conversationMessagesExporter,
  chatsExporter, messagesExporter, usageEventsExporter,
];

export type { PortabilityDb };
