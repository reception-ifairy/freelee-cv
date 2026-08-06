/**
 * Public surface of the group-chat module — other modules/core should
 * import from here, not reach into individual files (enforced by
 * convention/review, not tooling — see docs/08-module-architecture.md §1.5).
 */
export { manifest } from './manifest';
export { parseMentions, runPersonaTurn, runMentionedTurns, DEFAULT_MAX_PERSONAS_PER_ROOM } from './mentions';
export { notifyConversation, listenToConversation } from './realtime';
export {
  createRoomAction, addPersonaToRoomAction, addUserToRoomAction, postMessageAction, assertParticipant,
} from './actions';
export type {
  Conversation, ConversationParticipant, ConversationMessage, MessageReaction,
} from '@/db/schema';
