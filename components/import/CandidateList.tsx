'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { MemberAvatar } from '@/components/members/MemberAvatar';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import type { FamilyMember } from '@/lib/db/schema';
import { plusOneHour } from '@/lib/extract/toDraft';
import type { Candidate } from '@/lib/extract/types';

export type Reviewed = Candidate;

const INPUT = 'min-h-12 rounded-xl border border-line-strong bg-surface px-3 text-base';

/** Review step: every found entry can be edited or left out before anything is saved. */
export function CandidateList({
  candidates,
  members,
  saving,
  onAdd,
}: {
  candidates: readonly Candidate[];
  members: readonly FamilyMember[];
  saving: boolean;
  onAdd: (selected: Reviewed[]) => void;
}) {
  const t = useTranslations('import');
  const tForm = useTranslations('calendar.form');
  const [items, setItems] = useState(() => candidates.map((c) => ({ ...c, on: true })));
  const selected = items.filter((i) => i.on);
  const update = (key: string, patch: Partial<(typeof items)[number]>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  return (
    <section aria-labelledby="import-found" className="flex flex-col gap-3">
      <h3 id="import-found" className="text-lg font-bold">
        {t('found', { count: items.length })}
      </h3>
      {items.length === 0 && <p className="text-muted">{t('noneHint')}</p>}
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li
            key={item.key}
            className={`rounded-2xl border border-line p-3 ${item.on ? 'bg-surface' : 'bg-surface-2'}`}
          >
            <div className="flex items-start gap-1">
              <Checkbox
                checked={item.on}
                aria-label={t('include', { title: item.title })}
                onChange={(e) => update(item.key, { on: e.target.checked })}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <input
                  aria-label={tForm('title')}
                  value={item.title}
                  onChange={(e) => update(item.key, { title: e.target.value })}
                  className={`${INPUT} font-semibold`}
                />
                <div className="flex flex-wrap gap-2">
                  <input
                    type="date"
                    aria-label={tForm('date')}
                    value={item.date}
                    onChange={(e) => e.target.value && update(item.key, { date: e.target.value })}
                    className={INPUT}
                  />
                  {item.startTime ? (
                    <>
                      <input
                        type="time"
                        aria-label={tForm('startTime')}
                        value={item.startTime}
                        onChange={(e) =>
                          e.target.value && update(item.key, { startTime: e.target.value })
                        }
                        className={INPUT}
                      />
                      <input
                        type="time"
                        aria-label={tForm('endTime')}
                        value={item.endTime ?? plusOneHour(item.startTime)}
                        onChange={(e) => update(item.key, { endTime: e.target.value || undefined })}
                        className={INPUT}
                      />
                    </>
                  ) : (
                    <span className="inline-flex min-h-12 items-center rounded-xl bg-surface-2 px-3 text-sm font-semibold">
                      {t('allDay')}
                    </span>
                  )}
                </div>
                {members.length > 0 && (
                  <div
                    role="group"
                    aria-label={tForm('members')}
                    className="flex flex-wrap gap-1.5"
                  >
                    {members.map((m) => {
                      const on = item.memberIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            update(item.key, {
                              memberIds: on
                                ? item.memberIds.filter((id) => id !== m.id)
                                : [...item.memberIds, m.id],
                            })
                          }
                          className="inline-flex min-h-12 items-center gap-1.5 rounded-full border border-line-strong py-1 pr-3 pl-1 text-sm font-semibold aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent-soft-ink"
                        >
                          <MemberAvatar member={m} size="sm" />
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="truncate text-xs text-muted">{t('from', { source: item.source })}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {items.length > 0 && (
        <Button
          className="min-h-14 w-full"
          disabled={saving || selected.length === 0}
          onClick={() => onAdd(selected.map(({ on, ...c }) => c))}
        >
          {t('addSelected', { count: selected.length })}
        </Button>
      )}
    </section>
  );
}
