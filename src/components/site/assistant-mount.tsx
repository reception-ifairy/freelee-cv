import { getSiteAssistant } from '@/lib/assistant/config';
import { resolveLayoutForPersona } from '@/lib/chat/resolve-layout';
import { isTranscriptionConfigured } from '@/lib/voice/elevenlabs';
import { AssistantBubble } from './assistant-bubble';

/**
 * Decides on the server whether the site assistant exists at all.
 *
 * When it is off, unconfigured, or points at a missing/inactive persona, this
 * renders nothing — so a visitor's HTML contains no bubble, no chat component
 * and no assistant markup whatsoever. Hiding it on the client would ship the
 * whole chat runtime to everyone for no reason.
 */
export async function AssistantMount() {
  const assistant = await getSiteAssistant();
  if (!assistant) return null;

  // The same layout resolution the chat page and the embed widget use, so the
  // bubble honours whatever chat layout the persona is set to.
  const layoutKey = await resolveLayoutForPersona(
    assistant.personaId,
    assistant.chatLayout,
    assistant.audienceType,
    assistant.audienceSegments,
  );

  return (
    <AssistantBubble
      name={assistant.name}
      label={assistant.label}
      initials={assistant.initials}
      accentColor={assistant.accentColor}
      avatar={assistant.avatar}
      tagline={assistant.tagline}
      welcome={assistant.welcome}
      suggestions={assistant.suggestions}
      capabilities={assistant.capabilities}
      layoutKey={layoutKey}
      serverTranscription={await isTranscriptionConfigured()}
      showTools={assistant.showTools}
    />
  );
}
