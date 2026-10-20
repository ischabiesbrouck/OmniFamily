'use client';

import { CalendarPlus, FileUp, ListChecks, ShoppingBasket } from 'lucide-react';
import { useTimeZone, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { GroceryForm } from '@/components/groceries/GroceryForm';
import { TaskForm } from '@/components/tasks/TaskForm';
import { Sheet } from '@/components/ui/Sheet';
import { useLiveRecords, useMembers } from '@/lib/db/repositories/hooks';
import { todayIn } from '@/lib/time/zoned';
import { useUiStore } from '@/stores/uiStore';

function Choice({
  icon,
  title,
  hint,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-16 w-full items-center gap-3 rounded-2xl bg-surface-2 p-3 text-left transition hover:brightness-95"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-on-accent">
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-muted">{hint}</span>
      </span>
    </button>
  );
}

/** The global "+": event, task, grocery or import, from any screen. */
export function AddSheet() {
  const t = useTranslations('add');
  const tToast = useTranslations('toast');
  const zone = useTimeZone() ?? 'UTC';
  const sheet = useUiStore((s) => s.sheet);
  const openSheet = useUiStore((s) => s.openSheet);
  const openEditor = useUiStore((s) => s.openEditor);
  const toast = useUiStore((s) => s.toast);
  const members = useMembers() ?? [];
  const events = (useLiveRecords('event') ?? []).filter((e) => !e.recurrenceParentId);
  const close = (open: boolean) => !open && openSheet(null);

  return (
    <>
      <Sheet open={sheet === 'add'} onOpenChange={close} title={t('title')}>
        <div className="flex flex-col gap-2">
          <Choice
            icon={<CalendarPlus aria-hidden="true" className="size-5" />}
            title={t('event')}
            hint={t('eventHint')}
            onClick={() => openEditor({ mode: 'new', date: todayIn(zone) })}
          />
          <Choice
            icon={<ListChecks aria-hidden="true" className="size-5" />}
            title={t('task')}
            hint={t('taskHint')}
            onClick={() => openSheet('task')}
          />
          <Choice
            icon={<ShoppingBasket aria-hidden="true" className="size-5" />}
            title={t('grocery')}
            hint={t('groceryHint')}
            onClick={() => openSheet('grocery')}
          />
          <Choice
            icon={<FileUp aria-hidden="true" className="size-5" />}
            title={t('import')}
            hint={t('importHint')}
            onClick={() => openSheet('import')}
          />
        </div>
      </Sheet>
      <Sheet open={sheet === 'task'} onOpenChange={close} title={t('task')}>
        <TaskForm
          members={members}
          events={events}
          onAdded={() => {
            openSheet(null);
            toast(tToast('taskAdded'));
          }}
        />
      </Sheet>
      <Sheet open={sheet === 'grocery'} onOpenChange={close} title={t('grocery')}>
        <GroceryForm
          fallbackMemberId={members[0]?.id ?? ''}
          onAdded={() => toast(tToast('groceryAdded'))}
        />
      </Sheet>
    </>
  );
}
