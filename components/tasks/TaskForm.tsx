'use client';

import { useTimeZone, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { TextField } from '@/components/ui/TextField';
import { getRepositories } from '@/lib/db/repositories';
import { createTask, validateTaskDraft, type TaskDraft } from '@/lib/db/repositories/tasks';
import type { FamilyEvent, FamilyMember } from '@/lib/db/schema';

export function TaskForm({
  members,
  events = [],
  eventId,
  compact = false,
}: {
  members: readonly FamilyMember[];
  events?: readonly FamilyEvent[];
  /** Fixed link (inside the event dialog). */
  eventId?: string;
  compact?: boolean;
}) {
  const t = useTranslations('tasks');
  const zone = useTimeZone() ?? 'UTC';
  const empty: TaskDraft = { title: '', timeZone: zone, eventId };
  const [draft, setDraft] = useState<TaskDraft>(empty);
  const [pointsText, setPointsText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const withPoints = { ...draft, pointsValue: pointsText === '' ? undefined : Number(pointsText) };
  const error = submitted ? validateTaskDraft(withPoints) : undefined;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (validateTaskDraft(withPoints)) return;
    // Clear at once so the next task can be typed while this one is written (D-8.5).
    const typedPoints = pointsText;
    setDraft(empty);
    setPointsText('');
    setSubmitted(false);
    try {
      await createTask(getRepositories().core, withPoints);
    } catch {
      setDraft(draft);
      setPointsText(typedPoints);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-wrap items-end gap-2">
      <TextField
        className="min-w-48 flex-1"
        label={t('name')}
        value={draft.title}
        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        error={error === 'titleRequired' ? t('errors.titleRequired') : undefined}
      />
      <Select
        label={t('assignee')}
        value={draft.assigneeId ?? ''}
        options={[
          { value: '', label: t('nobody') },
          ...members.map((m) => ({ value: m.id, label: m.name })),
        ]}
        onChange={(e) => setDraft({ ...draft, assigneeId: e.target.value || undefined })}
      />
      <TextField
        className="w-24"
        label={t('points')}
        inputMode="numeric"
        value={pointsText}
        onChange={(e) => setPointsText(e.target.value.replace(/\D/g, '').slice(0, 4))}
        error={error === 'invalidPoints' ? t('errors.invalidPoints') : undefined}
      />
      {!compact && (
        <>
          <TextField
            type="date"
            label={t('due')}
            value={draft.dueDate ?? ''}
            onChange={(e) => setDraft({ ...draft, dueDate: e.target.value || undefined })}
            error={error === 'invalidDue' ? t('errors.invalidDue') : undefined}
          />
          {events.length > 0 && (
            <Select
              label={t('event')}
              value={draft.eventId ?? ''}
              options={[
                { value: '', label: t('noEvent') },
                ...events.map((e) => ({ value: e.id, label: e.title })),
              ]}
              onChange={(e) => setDraft({ ...draft, eventId: e.target.value || undefined })}
            />
          )}
        </>
      )}
      <Button type="submit">{t('add')}</Button>
    </form>
  );
}
