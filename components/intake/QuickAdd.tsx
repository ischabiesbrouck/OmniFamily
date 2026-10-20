'use client';

import { useFormatter, useLocale, useTimeZone, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { getRepositories } from '@/lib/db/repositories';
import { createEvent, type EventDraft } from '@/lib/db/repositories/events';
import { addGrocery } from '@/lib/db/repositories/groceries';
import { useMembers, useSetting } from '@/lib/db/repositories/hooks';
import { createTask } from '@/lib/db/repositories/tasks';
import type { ParsedFamilyEntry } from '@/lib/db/schema';
import { requestIntake } from '@/lib/intake/client';
import { grantConsent, INTAKE_CONSENT_KEY, isConsent } from '@/lib/intake/consent';
import { entryToDraft } from '@/lib/intake/toDraft';
import { instantToEpoch } from '@/lib/time/zoned';
import { useDeviceStore } from '@/stores/deviceStore';
import { ConsentDialog } from './ConsentDialog';

const LOW_CONFIDENCE = 0.6;

type Notice = 'unavailable' | 'offline' | 'failed' | 'declined' | 'added';

/**
 * Optional AI quick add (D2). Manual entry stays the default path; nothing is sent without
 * consent, and every result is reviewed before it is saved.
 */
export default function QuickAdd({ onEdit }: { onEdit: (draft: EventDraft) => void }) {
  const t = useTranslations('intake');
  const format = useFormatter();
  const zone = useTimeZone() ?? 'UTC';
  const locale = useLocale();
  const members = useMembers() ?? [];
  const consent = useSetting(INTAKE_CONSENT_KEY);
  const activeMemberId = useDeviceStore((s) => s.activeMemberId);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [entry, setEntry] = useState<ParsedFamilyEntry | null>(null);
  const [taskOn, setTaskOn] = useState<boolean[]>([]);
  const [groceryOn, setGroceryOn] = useState<boolean[]>([]);
  const core = getRepositories().core;
  const creator = activeMemberId ?? members.find((m) => m.role === 'parent')?.id ?? '';

  async function send() {
    setBusy(true);
    setNotice(null);
    const result = await requestIntake(text, members, { timeZone: zone, locale });
    setBusy(false);
    if (!result.ok) {
      setNotice(result.reason);
      return;
    }
    setEntry(result.entry);
    setTaskOn((result.entry.linkedTasks ?? []).map(() => true));
    setGroceryOn((result.entry.linkedGroceries ?? []).map(() => true));
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (text.trim() === '') return;
    if (isConsent(consent)) void send();
    else setAsking(true); // §7.1: ask before the first call
  }

  async function addAll() {
    if (!entry) return;
    const saved = await createEvent(core, entryToDraft(entry, creator));
    for (const [i, task] of (entry.linkedTasks ?? []).entries()) {
      if (taskOn[i])
        await createTask(core, {
          title: task.title,
          timeZone: entry.timeZone,
          assigneeId: task.assigneeId,
          eventId: saved.id,
        });
    }
    for (const [i, g] of (entry.linkedGroceries ?? []).entries()) {
      if (groceryOn[i])
        await addGrocery(core, {
          name: g.item,
          category: g.category ?? 'Other',
          addedByMemberId: creator,
          associatedEventId: saved.id,
        });
    }
    setEntry(null);
    setText('');
    setNotice('added');
  }

  const who = entry
    ? members
        .filter((m) => entry.assigneeIds.includes(m.id))
        .map((m) => m.name)
        .join(', ')
    : '';
  const when = entry
    ? entry.isAllDay
      ? format.dateTime(instantToEpoch(entry.startInstant), {
          dateStyle: 'full',
          timeZone: entry.timeZone,
        })
      : format.dateTime(instantToEpoch(entry.startInstant), {
          dateStyle: 'full',
          timeStyle: 'short',
          timeZone: zone,
        })
    : '';

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-ink/20 p-3">
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
        <TextField
          className="min-w-56 flex-1"
          label={t('label')}
          hint={t('hint')}
          placeholder={t('placeholder')}
          value={text}
          maxLength={2_000}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" disabled={busy || text.trim() === ''}>
          {busy ? t('busy') : t('submit')}
        </Button>
      </form>

      {notice && (
        <p
          role={notice === 'added' ? 'status' : 'alert'}
          className={notice === 'added' ? '' : 'font-medium text-danger'}
        >
          {t(notice)}
        </p>
      )}

      {entry && (
        <div className="flex flex-col gap-2 rounded-lg bg-ink/5 p-3">
          <h2 className="font-semibold">{t('review')}</h2>
          {entry.confidenceScore < LOW_CONFIDENCE && (
            <p className="font-medium text-danger">{t('lowConfidence')}</p>
          )}
          <p className="text-lg font-semibold">{entry.title}</p>
          <p>
            {t('when')}: {when}
          </p>
          {who && (
            <p>
              {t('who')}: {who}
            </p>
          )}
          {(entry.linkedTasks?.length || entry.linkedGroceries?.length) && (
            <fieldset className="flex flex-col gap-1">
              <legend className="font-medium">{t('alsoAdd')}</legend>
              {entry.linkedTasks?.map((task, i) => (
                <label key={`t${i}`} className="flex min-h-12 items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-6"
                    checked={taskOn[i] ?? false}
                    onChange={(e) =>
                      setTaskOn((on) => on.map((v, j) => (j === i ? e.target.checked : v)))
                    }
                  />
                  {task.title}
                </label>
              ))}
              {entry.linkedGroceries?.map((g, i) => (
                <label key={`g${i}`} className="flex min-h-12 items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-6"
                    checked={groceryOn[i] ?? false}
                    onChange={(e) =>
                      setGroceryOn((on) => on.map((v, j) => (j === i ? e.target.checked : v)))
                    }
                  />
                  {g.item}
                </label>
              ))}
            </fieldset>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void addAll()}>{t('add')}</Button>
            <Button
              variant="secondary"
              onClick={() => {
                onEdit(entryToDraft(entry, creator));
                setEntry(null);
              }}
            >
              {t('edit')}
            </Button>
            <Button variant="ghost" onClick={() => setEntry(null)}>
              {t('discard')}
            </Button>
          </div>
        </div>
      )}

      <ConsentDialog
        open={asking}
        onAllow={() => {
          setAsking(false);
          void grantConsent(core.db, Date.now()).then(send);
        }}
        onDecline={() => {
          setAsking(false);
          setNotice('declined');
        }}
      />
    </section>
  );
}
