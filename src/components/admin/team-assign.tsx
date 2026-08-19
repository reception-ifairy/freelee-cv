'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors,
  useDroppable, pointerWithin, rectIntersection, MeasuringStrategy,
  type DragEndEvent, type DragStartEvent, type CollisionDetection,
} from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Crown, GripVertical, Plus, X } from 'lucide-react';
import { PersonaMark } from '@/components/site/persona-mark';
import { assignCrewMembersAction } from '@/server/actions/admin-crews';
import { cn } from '@/lib/utils';

/**
 * Building a bot team by dragging specialists into it.
 *
 * This is the first **cross-container** drag in the codebase. Every existing
 * `DndContext` sorts a single vertical list and applies
 * `restrictToVerticalAxis` / `restrictToParentElement` — both of which actively
 * prevent moving an item from one container to another, which is the whole
 * point here. So this one needs `useDroppable` zones, a `DragOverlay` (without
 * it the card vanishes the moment it leaves its origin list) and
 * `closestCorners`, which behaves better than `closestCenter` across two
 * columns of different heights.
 *
 * **Drag is not the only way in.** Each card also has a plain button, because
 * `block-list.tsx` established that a drag interface here keeps a non-drag
 * fallback — and a keyboard sensor is not a substitute for a control you can
 * see.
 */

export type AssignablePersona = {
  id: number;
  slug: string;
  name: string;
  expertise: string | null;
  accentColor: string;
  categoryId: number | null;
  categorySlug: string | null;
  categoryColor: string | null;
  sectorSlug: string | null;
  categoryName: string | null;
  sectorName: string | null;
};

/**
 * Collision detection for two containers.
 *
 * `closestCorners` — the house default for single lists — measures from the
 * dragged element's corners, and across two columns it kept resolving to
 * nothing: the overlay followed the cursor while the target zone never lit up.
 * `pointerWithin` asks the simpler and, here, correct question: what is under
 * the pointer. `rectIntersection` is the fallback for the moment the pointer is
 * between two cards and inside neither.
 */
const collisionDetection: CollisionDetection = (args) => {
  const withinPointer = pointerWithin(args);
  return withinPointer.length > 0 ? withinPointer : rectIntersection(args);
};

export function TeamAssign({
  crewId,
  mode,
  available,
  initialMembers,
  supervisorId,
}: {
  crewId: string;
  mode: string;
  available: AssignablePersona[];
  initialMembers: AssignablePersona[];
  supervisorId: number | null;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [dragging, setDragging] = useState<AssignablePersona | null>(null);
  const [pending, startTransition] = useTransition();

  // The server is the source of truth. Parking rows in state without resyncing
  // is exactly what once made the block list show stale data after a
  // revalidate — see docs/33.
  useEffect(() => setMembers(initialMembers), [initialMembers]);

  const memberIds = new Set(members.map((m) => m.id));
  const pool = available.filter((p) => !memberIds.has(p.id));

  const sensors = useSensors(
    // A distance threshold so clicking the "add" button inside a card is not
    // swallowed as the start of a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function persist(next: AssignablePersona[]) {
    setMembers(next);
    startTransition(async () => {
      const data = new FormData();
      data.set('crewId', crewId);
      data.set('personaIds', JSON.stringify(next.map((m) => m.id)));
      await assignCrewMembersAction(data);
    });
  }

  function onDragStart(event: DragStartEvent) {
    const id = Number(event.active.id);
    setDragging(available.find((p) => p.id === id) ?? members.find((m) => m.id === id) ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setDragging(null);
    if (!over) return;

    const id = Number(active.id);
    const overTeam = over.id === 'team' || members.some((m) => m.id === Number(over.id));
    const inTeam = memberIds.has(id);

    // Dropped on the team from the pool — append, because a new member joining
    // the end of a pipeline is the least surprising default.
    if (overTeam && !inTeam) {
      const persona = pool.find((p) => p.id === id);
      if (persona) persist([...members, persona]);
      return;
    }

    // Reordered inside the team.
    if (overTeam && inTeam && active.id !== over.id) {
      const from = members.findIndex((m) => m.id === id);
      const to = members.findIndex((m) => m.id === Number(over.id));
      if (from !== -1 && to !== -1) persist(arrayMove(members, from, to));
      return;
    }

    // Dropped back on the pool — removed from the team.
    if (over.id === 'pool' && inTeam) {
      persist(members.filter((m) => m.id !== id));
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      // Droppable rects are measured once on drag start by default. Both zones
      // change height as cards move between them, so a stale rect makes the
      // target drift away from where it is drawn.
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className={cn('grid gap-4 lg:grid-cols-2', pending && 'opacity-80')}>
        <Zone id="pool" label="Available specialists" hint="Drag one across, or use the + button.">
          {/* Each container needs its own SortableContext, including this one.
              `useSortable` registers a card through the nearest context — with
              none, the pool cards rendered fine and simply could not be picked
              up, which looks identical to a broken drop target. */}
          <SortableContext items={pool.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            {pool.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-500">Every active persona is on this team.</p>
            ) : (
              pool.map((persona) => (
                <AssignCard
                  key={persona.id}
                  persona={persona}
                  action={{ icon: <Plus className="size-3.5" />, label: `Add ${persona.name}`, onClick: () => persist([...members, persona]) }}
                />
              ))
            )}
          </SortableContext>
        </Zone>

        <Zone
          id="team"
          label={mode === 'sequential' ? 'Turn order' : 'Team'}
          hint={mode === 'sequential' ? 'Each acts once, in this order.' : 'All members take part.'}
        >
          <SortableContext items={members.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            {members.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-500">Drop a specialist here to build the team.</p>
            ) : (
              members.map((persona, index) => (
                <AssignCard
                  key={persona.id}
                  persona={persona}
                  sortable
                  index={mode === 'sequential' ? index + 1 : undefined}
                  isSupervisor={persona.id === supervisorId}
                  action={{ icon: <X className="size-3.5" />, label: `Remove ${persona.name}`, onClick: () => persist(members.filter((m) => m.id !== persona.id)) }}
                />
              ))
            )}
          </SortableContext>
        </Zone>
      </div>

      {/* Without an overlay the card disappears while crossing the gap between
          the two columns, because it is removed from its origin list before it
          arrives anywhere. */}
      <DragOverlay>
        {dragging ? (
          <div className="w-72 rotate-2 rounded-control border border-brand-400/50 bg-white p-2.5 shadow-2xl dark:bg-[#0d0d10]">
            <CardBody persona={dragging} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Zone({ id, label, hint, children }: { id: string; label: string; hint: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="mb-2 text-xs text-slate-500">{hint}</p>
      <div
        ref={setNodeRef}
        // A stable hook for tests and for anything that needs to address a zone
        // — `useDroppable` puts its id in React state, not on the element.
        data-zone={id}
        className={cn(
          'min-h-40 space-y-1.5 rounded-card border border-dashed p-2 transition-colors',
          isOver ? 'border-brand-500 bg-brand-500/[0.06]' : 'hairline',
        )}
      >
        {children}
      </div>
    </div>
  );
}

function AssignCard({
  persona, sortable, index, isSupervisor, action,
}: {
  persona: AssignablePersona;
  sortable?: boolean;
  index?: number;
  isSupervisor?: boolean;
  action: { icon: React.ReactNode; label: string; onClick: () => void };
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: persona.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-control border hairline bg-white/[0.02] p-2',
        isDragging && 'opacity-40',
      )}
    >
      {/* The grip is the only thing that starts a drag. Without splitting it
          from the card body the action button below becomes unclickable — the
          same reason block-card.tsx splits its own. */}
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Move ${persona.name}`}
        {...attributes}
        {...listeners}
        className="cursor-grab text-slate-500 hover:text-slate-300 active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>

      {index !== undefined ? (
        <span className="grid size-5 shrink-0 place-items-center rounded bg-white/[0.06] font-mono text-[10px]">{index}</span>
      ) : null}

      <CardBody persona={persona} />

      {isSupervisor ? <Crown className="size-3.5 shrink-0 text-amber-400" /> : null}

      <button
        type="button"
        onClick={action.onClick}
        title={action.label}
        className="focus-ring grid size-6 shrink-0 place-items-center rounded text-slate-400 transition hover:bg-white/10 hover:text-slate-200"
      >
        {action.icon}
        <span className="sr-only">{action.label}</span>
      </button>
    </div>
  );
}

function CardBody({ persona }: { persona: AssignablePersona }) {
  return (
    <>
      <PersonaMark
        personaKey={persona.slug}
        categoryKey={persona.categorySlug}
        sectorKey={persona.sectorSlug}
        categoryIndex={persona.categoryId}
        accent={persona.categoryColor ?? persona.accentColor}
        className="size-7 shrink-0"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{persona.name}</span>
        <span className="block truncate text-[11px] text-slate-500">
          {persona.sectorName ?? persona.categoryName ?? persona.expertise ?? 'Unfiled'}
        </span>
      </span>
    </>
  );
}
