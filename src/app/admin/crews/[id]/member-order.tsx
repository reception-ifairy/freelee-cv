'use client';

import { useEffect, useState, useTransition } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Crown } from 'lucide-react';
import { reorderCrewMembersAction } from '@/server/actions/admin-crews';
import { cn } from '@/lib/utils';

export type MemberRow = { id: number; personaId: number; name: string; isSupervisor: boolean; instructions: string | null };

/**
 * Turn order, by drag.
 *
 * In pipeline mode this list *is* the behaviour of the feature — each member
 * runs once, in this order, seeing everything before it. Until now there was no
 * way to change it at all: crews were create-only, and the create form derived
 * position from database row order while telling the user the tick order
 * decided it.
 */
export function MemberOrder({ crewId, members, mode }: { crewId: string; members: MemberRow[]; mode: string }) {
  const [items, setItems] = useState(members);
  const [pending, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Server rows are the source of truth. Parking them in useState without
  // resyncing is exactly what made the block list show stale data after a
  // revalidate — see docs/33.
  useEffect(() => setItems(members), [members]);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const next = arrayMove(items, items.findIndex((m) => m.id === active.id), items.findIndex((m) => m.id === over.id));
    setItems(next);

    startTransition(async () => {
      const data = new FormData();
      data.set('crewId', crewId);
      data.set('order', JSON.stringify(next.map((m) => m.id)));
      await reorderCrewMembersAction(data);
    });
  }

  return (
    <div className={cn('space-y-1.5', pending && 'opacity-70')}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          {items.map((member, index) => (
            <Row key={member.id} member={member} index={index} showOrder={mode === 'sequential'} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

function Row({ member, index, showOrder }: { member: MemberRow; index: number; showOrder: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: member.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2.5 rounded-control border hairline px-3 py-2 text-sm',
        isDragging && 'z-10 shadow-lg',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${member.name}`}
        className="cursor-grab text-slate-500 hover:text-slate-300 active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>

      {/* Only pipeline mode has a turn order. Numbering a fan-out would imply
          a sequence that does not exist. */}
      {showOrder ? (
        <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-white/[0.06] font-mono text-[11px]">
          {index + 1}
        </span>
      ) : null}

      <span className="min-w-0 flex-1 truncate">{member.name}</span>

      {member.isSupervisor ? (
        <span title="Supervisor" className="text-amber-400"><Crown className="size-3.5" /></span>
      ) : null}
    </div>
  );
}
