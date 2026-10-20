'use client';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { IconButton } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { useOptimisticToggle } from '@/components/ui/useOptimisticToggle';
import { getRepositories } from '@/lib/db/repositories';
import { removeGrocery, setPurchased } from '@/lib/db/repositories/groceries';
import type { GroceryItem } from '@/lib/db/schema';

export function GroceryItemRow({
  item,
  eventTitle,
}: {
  item: GroceryItem;
  eventTitle?: string | undefined;
}) {
  const t = useTranslations('groceries');
  const core = getRepositories().core;
  const [purchased, setPurchasedNow] = useOptimisticToggle(item.purchased, (next) =>
    setPurchased(core, item.id, next),
  );
  return (
    <li className="flex items-center gap-1 rounded-xl bg-surface-2 pr-1">
      <Checkbox
        checked={purchased}
        aria-label={
          purchased ? t('markNeeded', { name: item.name }) : t('markBought', { name: item.name })
        }
        onChange={(e) => setPurchasedNow(e.target.checked)}
      />
      <span className={`min-w-0 flex-1 py-2.5 ${purchased ? 'text-muted line-through' : ''}`}>
        <span className="font-semibold">{item.name}</span>
        {item.quantity && <span className="text-muted"> · {item.quantity}</span>}
        {eventTitle && (
          <span className="block text-sm text-muted">{t('forEvent', { title: eventTitle })}</span>
        )}
      </span>
      <IconButton
        label={t('delete', { name: item.name })}
        onClick={() => void removeGrocery(core, item.id)}
      >
        <Trash2 aria-hidden="true" className="size-5" />
      </IconButton>
    </li>
  );
}
