'use client';

import { AlignLeft, Clock, Lock, MapPin, Repeat, Users } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { MemberAvatar } from '@/components/members/MemberAvatar';
import { draftFromOccurrence } from '@/lib/db/repositories/events';
import type { FamilyMember } from '@/lib/db/schema';
import type { Occurrence } from '@/lib/recurrence/expand';
import { occurrenceColor, useTimeLabel } from './OccurrenceChip';

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex min-h-14 items-center gap-3 rounded-tile bg-surface-2 px-3 py-2.5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface">
        {icon}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}

/** Read-only view of an event (opens first; the pencil switches to the editor). */
export function EventDetails({
  occurrence,
  members,
}: {
  occurrence: Occurrence;
  members: readonly FamilyMember[];
}) {
  const t = useTranslations('calendar');
  const tForm = useTranslations('calendar.form');
  const format = useFormatter();
  const time = useTimeLabel();
  const draft = draftFromOccurrence(occurrence);
  const people = members.filter((m) => draft.memberIds.includes(m.id));
  const color = occurrenceColor(occurrence, members);
  const day = format.dateTime(new Date(occurrence.start), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: occurrence.isAllDay ? 'UTC' : draft.timeZone,
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-3">
        <span
          className="tint rounded-full px-3 py-1 text-sm font-semibold text-ink"
          style={{ ['--tint' as string]: color }}
        >
          {occurrence.isAllDay
            ? t('allDay')
            : t('timeRange', { start: time(occurrence.start), end: time(occurrence.end) })}
        </span>
        {people.length > 0 && (
          <span className="flex -space-x-2" aria-hidden="true">
            {people.map((m) => (
              <MemberAvatar key={m.id} member={m} size="lg" />
            ))}
          </span>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        <Row icon={<Clock aria-hidden="true" className="size-5" />}>
          <span className="block font-semibold first-letter:uppercase">{day}</span>
          <span className="block text-sm text-muted">
            {occurrence.isAllDay
              ? t('allDay')
              : t('timeRange', { start: time(occurrence.start), end: time(occurrence.end) })}
          </span>
        </Row>
        {draft.repeat !== 'none' && (
          <Row icon={<Repeat aria-hidden="true" className="size-5" />}>
            <span className="font-semibold">{tForm(`repeat${draft.repeat}`)}</span>
          </Row>
        )}
        {people.length > 0 && (
          <Row icon={<Users aria-hidden="true" className="size-5" />}>
            <span className="font-semibold">{people.map((m) => m.name).join(', ')}</span>
          </Row>
        )}
        {draft.location && (
          <Row icon={<MapPin aria-hidden="true" className="size-5" />}>
            <span className="font-semibold">{draft.location}</span>
          </Row>
        )}
        {draft.description && (
          <Row icon={<AlignLeft aria-hidden="true" className="size-5" />}>
            <span className="whitespace-pre-line">{draft.description}</span>
          </Row>
        )}
        {draft.visibility === 'private' && (
          <Row icon={<Lock aria-hidden="true" className="size-5" />}>
            <span className="font-semibold">{tForm('visibilityPrivate')}</span>
          </Row>
        )}
      </ul>
    </div>
  );
}
