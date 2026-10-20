'use client';

import { useTimeZone, useTranslations } from 'next-intl';
import { Sheet } from '@/components/ui/Sheet';
import { getRepositories } from '@/lib/db/repositories';
import {
  createEvent,
  deleteEvent,
  draftFromOccurrence,
  isRecurring,
  updateEvent,
  type EventDraft,
} from '@/lib/db/repositories/events';
import { useMembers } from '@/lib/db/repositories/hooks';
import { useDeviceStore } from '@/stores/deviceStore';
import { useUiStore } from '@/stores/uiStore';
import { EventForm } from './EventForm';
import { LinkedItems } from './LinkedItems';

/** The one event editor, opened from anywhere through the UI store (lazy-loaded). */
export function EventEditor() {
  const t = useTranslations('calendar.form');
  const tToast = useTranslations('toast');
  const state = useUiStore((s) => s.editor);
  const close = () => useUiStore.getState().openEditor(null);
  const toast = useUiStore((s) => s.toast);
  const members = useMembers() ?? [];
  const zone = useTimeZone() ?? 'UTC';
  const activeMemberId = useDeviceStore((s) => s.activeMemberId);
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
      timeZone: zone,
      memberIds: activeMemberId ? [activeMemberId] : [],
      visibility: 'family',
      repeat: 'none',
      createdById: creator,
    };
  }

  return (
    <Sheet
      open={state !== null}
      onOpenChange={(open) => !open && close()}
      title={state?.mode === 'edit' ? t('editTitle') : t('newTitle')}
    >
      {state && initial && (
        <EventForm
          key={state.mode === 'edit' ? state.occurrence.key : state.date}
          initial={initial}
          members={members}
          recurring={state.mode === 'edit' && isRecurring(state.occurrence)}
          onCancel={close}
          onSave={async (draft, scope) => {
            if (state.mode === 'edit') await updateEvent(core, state.occurrence, draft, scope);
            else await createEvent(core, draft);
            close();
            toast(state.mode === 'edit' ? tToast('saved') : tToast('eventAdded'));
          }}
          onDelete={
            state.mode === 'edit'
              ? async (scope) => {
                  await deleteEvent(core, state.occurrence, scope);
                  close();
                  toast(tToast('deleted'));
                }
              : undefined
          }
        />
      )}
      {state?.mode === 'edit' && (
        <div className="mt-6">
          <LinkedItems eventId={state.occurrence.seriesId} members={members} />
        </div>
      )}
    </Sheet>
  );
}
