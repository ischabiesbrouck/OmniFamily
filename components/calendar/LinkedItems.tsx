'use client';

import { useTranslations } from 'next-intl';
import { GroceryForm } from '@/components/groceries/GroceryForm';
import { GroceryItemRow } from '@/components/groceries/GroceryItemRow';
import { TaskForm } from '@/components/tasks/TaskForm';
import { TaskItem } from '@/components/tasks/TaskItem';
import { useLiveRecords } from '@/lib/db/repositories/hooks';
import type { FamilyMember } from '@/lib/db/schema';

/** Tasks and shopping linked to an event (a series links through its master). */
export function LinkedItems({
  eventId,
  members,
}: {
  eventId: string;
  members: readonly FamilyMember[];
}) {
  const t = useTranslations('linked');
  const tasks = (useLiveRecords('task') ?? []).filter((task) => task.eventId === eventId);
  const groceries = (useLiveRecords('grocery') ?? []).filter(
    (g) => g.associatedEventId === eventId,
  );

  return (
    <section
      aria-labelledby="linked-heading"
      className="flex flex-col gap-3 border-t border-ink/15 pt-4"
    >
      <h3 id="linked-heading" className="text-lg font-semibold">
        {t('title')}
      </h3>
      <h4 className="font-semibold">{t('tasks')}</h4>
      {tasks.length > 0 && (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} members={members} />
          ))}
        </ul>
      )}
      <TaskForm members={members} eventId={eventId} compact />
      <h4 className="font-semibold">{t('groceries')}</h4>
      {groceries.length > 0 && (
        <ul className="flex flex-col gap-2">
          {groceries.map((item) => (
            <GroceryItemRow key={item.id} item={item} />
          ))}
        </ul>
      )}
      <GroceryForm eventId={eventId} fallbackMemberId={members[0]?.id ?? ''} />
    </section>
  );
}
