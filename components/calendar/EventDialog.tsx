'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useTranslations } from 'next-intl';
import { getRepositories } from '@/lib/db/repositories';
import {
  createEvent,
  deleteEvent,
  draftFromOccurrence,
  isRecurring,
  updateEvent,
  type EventDraft,
} from '@/lib/db/repositories/events';
import type { FamilyMember } from '@/lib/db/schema';
import type { Occurrence } from '@/lib/recurrence/expand';
import type { FloatingDate } from '@/lib/time/zoned';
import { EventForm } from './EventForm';
import { LinkedItems } from './LinkedItems';

export type EditorState =
  | { mode: 'new'; date: FloatingDate; draft?: EventDraft }
  | { mode: 'edit'; occurrence: Occurrence }
  | null;

export function EventDialog({
  state,
  members,
  timeZone,
  activeMemberId,
  onClose,
}: {
  state: EditorState;
  members: readonly FamilyMember[];
  timeZone: string;
  activeMemberId: string | null;
  onClose: () => void;
}) {
  const t = useTranslations('calendar.form');
  const core = getRepositories().core;

  let initial: EventDraft | undefined;
  if (state?.mode === 'edit') initial = draftFromOccurrence(state.occurrence);
  else if (state?.mode === 'new' && state.draft) initial = state.draft;
  else if (state?.mode === 'new') {
    const creator = activeMemberId ?? members.find((m) => m.role === 'parent')?.id ?? '';
    initial = {
      title: '',
      description: '',
      location: '',
      isAllDay: false,
      date: state.date,
      endDate: state.date,
      startTime: '09:00',
      endTime: '10:00',
      timeZone,
      memberIds: activeMemberId ? [activeMemberId] : [],
      visibility: 'family',
      repeat: 'none',
      createdById: creator,
    };
  }

  return (
    <Dialog.Root open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-ink/50" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
        >
          <Dialog.Title className="mb-4 text-xl font-semibold">
            {state?.mode === 'edit' ? t('editTitle') : t('newTitle')}
          </Dialog.Title>
          {state && initial && (
            <EventForm
              key={state.mode === 'edit' ? state.occurrence.key : state.date}
              initial={initial}
              members={members}
              recurring={state.mode === 'edit' && isRecurring(state.occurrence)}
              onCancel={onClose}
              onSave={async (draft, scope) => {
                if (state.mode === 'edit') await updateEvent(core, state.occurrence, draft, scope);
                else await createEvent(core, draft);
                onClose();
              }}
              onDelete={
                state.mode === 'edit'
                  ? async (scope) => {
                      await deleteEvent(core, state.occurrence, scope);
                      onClose();
                    }
                  : undefined
              }
            />
          )}
          {state?.mode === 'edit' && (
            <div className="mt-4">
              <LinkedItems eventId={state.occurrence.seriesId} members={members} />
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
