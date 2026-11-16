'use client';

import { MessagesSquare } from 'lucide-react';
import { ResourceView, type ResourceItem } from '@/components/admin/resource-view';
import { Meter } from '@/components/ui/meter';

export type RoomRow = {
  id: string;
  title: string;
  kind: string;
  team: string;
  project: string | null;
  participants: number;
  messages: number;
  cost: number;
  last: string;
};

/**
 * Rooms in the taxonomy's layout (freelee #92): rooms and playgrounds on the
 * left, the list, a card with who is in it and what it cost; **Open** reads
 * the conversation. The card carries the same facts the old list showed —
 * nothing of what was said.
 */
export function RoomsList({ rows }: { rows: RoomRow[] }) {
  const topCost = Math.max(1, ...rows.map((r) => r.cost));
  const items: ResourceItem[] = rows.map((room) => ({
    id: room.id,
    title: room.title,
    subtitle: [room.team, room.project, `${room.participants} participant${room.participants === 1 ? '' : 's'}`].filter(Boolean).join(' · '),
    href: `/admin/rooms/${room.id}`,
    badges: [{ label: room.kind === 'playground' ? 'Playground' : 'Room', tone: room.kind === 'playground' ? ('amber' as const) : ('slate' as const) }],
    meta: [
      { label: 'Credits', value: <Meter value={room.cost} max={topCost} display={`${room.cost}c`} label="Credits" /> },
      { label: 'Messages', value: room.messages.toLocaleString('en-GB') },
      { label: 'Last message', value: room.last },
    ],
  }));

  return (
    <ResourceView
      module="rooms"
      view="list"
      browser={{ groups: ['Room', 'Playground'], railLabel: 'Kind' }}
      items={items}
      empty={{
        icon: MessagesSquare,
        title: 'No rooms yet',
        description: 'A room is a conversation several people and bots share, where an @mention asks a bot to reply.',
      }}
    />
  );
}
