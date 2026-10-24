'use client';

import { Pencil } from 'lucide-react';
import { useTimeZone, useTranslations } from 'next-intl';
import { useState } from 'react';
import { IconButton } from '@/components/ui/Button';
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
import { EventDetails } from './EventDetails';
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
  const tCommon = useTranslations('common');
  const [editing, setEditing] = useState(false);
  const openKey = state?.mode === 'edit' ? state.occurrence.key : (state?.mode ?? null);
  const [seenKey, setSeenKey] = useState(openKey);
  if (seenKey !== openKey) {
    // Another event (or none) opened: start again in the detail view.
    setSeenKey(openKey);
    setEditing(false);
  }

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

  // An existing event opens as a read-only detail view; the pencil switches to the form.
  const viewing = state?.mode === 'edit' && !editing;

  return (
    <Sheet
      open={state !== null}
      onOpenChange={(open) => !open && close()}
      title={
        state?.mode === 'edit'
          ? viewing
            ? state.occurrence.event.title
            : t('editTitle')
          : t('newTitle')
      }
      hero={viewing}
      actions={
        viewing ? (
          <IconButton label={tCommon('edit')} variant="primary" onClick={() => setEditing(true)}>
            <Pencil aria-hidden="true" className="size-5" />
          </IconButton>
        ) : undefined
      }
    >
      {state?.mode === 'edit' && viewing && (
        <EventDetails occurrence={state.occurrence} members={members} />
      )}
      {state && initial && !viewing && (
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
          <LinkedItems eventId={state.occurrence.seriesId} members={members} readOnly={viewing} />
        </div>
      )}
    </Sheet>
  );
}
