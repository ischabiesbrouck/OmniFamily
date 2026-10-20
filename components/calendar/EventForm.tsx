'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState, type FormEvent } from 'react';
import { MemberAvatar } from '@/components/members/MemberAvatar';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { TextField } from '@/components/ui/TextField';
import { validateDraft, type EditScope, type EventDraft } from '@/lib/db/repositories/events';
import type { FamilyMember } from '@/lib/db/schema';
import { REPEAT_FREQUENCIES } from '@/lib/recurrence/expand';
import { compareDates, supportedTimeZones } from '@/lib/time/zoned';

export function EventForm({
  initial,
  members,
  recurring,
  onSave,
  onDelete,
  onCancel,
}: {
  initial: EventDraft;
  members: readonly FamilyMember[];
  /** Existing occurrence of a series: ask whether changes apply to it or to all. */
  recurring: boolean;
  onSave: (draft: EventDraft, scope: EditScope) => Promise<void>;
  onDelete?: ((scope: EditScope) => Promise<void>) | undefined;
  onCancel: () => void;
}) {
  const t = useTranslations('calendar.form');
  const tCommon = useTranslations('common');
  const [draft, setDraft] = useState(initial);
  const [scope, setScope] = useState<EditScope>('this');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const zones = useMemo(() => supportedTimeZones(initial.timeZone), [initial.timeZone]);
  const error = submitted ? validateDraft(draft) : undefined;

  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (validateDraft(draft)) return;
    setBusy(true);
    await onSave(draft, recurring ? scope : 'all');
  }

  async function remove() {
    if (!onDelete || !window.confirm(t('deleteConfirm'))) return;
    setBusy(true);
    await onDelete(recurring ? scope : 'all');
  }

  const repeatOptions = [
    { value: 'none', label: t('repeatNone') },
    ...REPEAT_FREQUENCIES.map((f) => ({ value: f, label: t(`repeat${f}`) })),
  ];

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <TextField
        label={t('title')}
        value={draft.title}
        onChange={(e) => set('title', e.target.value)}
        autoFocus
        error={error === 'titleRequired' ? t('errors.titleRequired') : undefined}
      />

      <label className="flex min-h-12 items-center gap-3 font-medium">
        <input
          type="checkbox"
          className="size-6"
          checked={draft.isAllDay}
          onChange={(e) => setDraft((d) => ({ ...d, isAllDay: e.target.checked, endDate: d.date }))}
        />
        {t('allDay')}
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextField
          type="date"
          label={draft.isAllDay ? t('startDate') : t('date')}
          value={draft.date}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              date: e.target.value,
              endDate: compareDates(d.endDate, e.target.value) < 0 ? e.target.value : d.endDate,
            }))
          }
          error={error === 'invalidDate' ? t('errors.invalidDate') : undefined}
        />
        {draft.isAllDay ? (
          <TextField
            type="date"
            label={t('endDate')}
            value={draft.endDate}
            min={draft.date}
            onChange={(e) => set('endDate', e.target.value)}
            error={error === 'endBeforeStart' ? t('errors.endBeforeStart') : undefined}
          />
        ) : (
          <>
            <TextField
              type="time"
              label={t('startTime')}
              value={draft.startTime}
              onChange={(e) => set('startTime', e.target.value)}
              error={error === 'invalidTime' ? t('errors.invalidTime') : undefined}
            />
            <TextField
              type="time"
              label={t('endTime')}
              value={draft.endTime}
              onChange={(e) => set('endTime', e.target.value)}
              error={error === 'endBeforeStart' ? t('errors.endBeforeStart') : undefined}
            />
          </>
        )}
      </div>

      {!draft.isAllDay && (
        <Select
          label={t('timeZone')}
          value={draft.timeZone}
          options={zones.map((z) => ({ value: z, label: z.replaceAll('_', ' ') }))}
          onChange={(e) => set('timeZone', e.target.value)}
        />
      )}

      <Select
        label={t('repeat')}
        value={draft.repeat}
        options={repeatOptions}
        onChange={(e) => set('repeat', e.target.value as EventDraft['repeat'])}
      />

      <fieldset className="flex flex-col gap-1">
        <legend className="font-medium">{t('members')}</legend>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <label
              key={m.id}
              className="flex min-h-12 items-center gap-2 rounded-lg border border-ink/20 px-3"
            >
              <input
                type="checkbox"
                className="size-5"
                checked={draft.memberIds.includes(m.id)}
                onChange={(e) =>
                  set(
                    'memberIds',
                    e.target.checked
                      ? [...draft.memberIds, m.id]
                      : draft.memberIds.filter((id) => id !== m.id),
                  )
                }
              />
              <MemberAvatar member={m} size="sm" />
              {m.name}
            </label>
          ))}
        </div>
      </fieldset>

      <Select
        label={t('visibility')}
        value={draft.visibility}
        options={[
          { value: 'family', label: t('visibilityFamily') },
          { value: 'private', label: t('visibilityPrivate') },
        ]}
        onChange={(e) => set('visibility', e.target.value === 'private' ? 'private' : 'family')}
      />
      <TextField
        label={t('location')}
        value={draft.location}
        onChange={(e) => set('location', e.target.value)}
      />
      <TextField
        label={t('description')}
        value={draft.description}
        onChange={(e) => set('description', e.target.value)}
      />

      {recurring && (
        <Select
          label={t('scope')}
          value={scope}
          options={[
            { value: 'this', label: t('scopeThis') },
            { value: 'all', label: t('scopeAll') },
          ]}
          onChange={(e) => setScope(e.target.value === 'all' ? 'all' : 'this')}
        />
      )}

      {error === 'invalidTimeZone' && (
        <p role="alert" className="font-medium text-danger">
          {t('errors.invalidTimeZone')}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {tCommon('save')}
        </Button>
        {onDelete && (
          <Button variant="danger" disabled={busy} onClick={() => void remove()}>
            {t('delete')}
          </Button>
        )}
        <Button variant="ghost" onClick={onCancel}>
          {tCommon('cancel')}
        </Button>
      </div>
    </form>
  );
}
