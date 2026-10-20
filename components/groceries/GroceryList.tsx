'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { getRepositories } from '@/lib/db/repositories';
import { clearPurchased, groupByCategory } from '@/lib/db/repositories/groceries';
import { useLiveRecords, useMembers } from '@/lib/db/repositories/hooks';
import { GroceryForm } from './GroceryForm';
import { GroceryItemRow } from './GroceryItemRow';

export function GroceryList() {
  const t = useTranslations('groceries');
  const items = useLiveRecords('grocery');
  const events = useLiveRecords('event');
  const members = useMembers() ?? [];
  const groups = groupByCategory(items ?? []);
  const titles = new Map((events ?? []).map((e) => [e.id, e.title]));
  const anyPurchased = (items ?? []).some((i) => i.purchased);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-semibold">{t('title')}</h1>
        {anyPurchased && (
          <Button variant="secondary" onClick={() => void clearPurchased(getRepositories().core)}>
            {t('clearPurchased')}
          </Button>
        )}
      </div>
      <GroceryForm fallbackMemberId={members[0]?.id ?? ''} />
      {groups.length === 0 ? (
        <p className="text-muted">{t('empty')}</p>
      ) : (
        groups.map(([category, list]) => (
          <section key={category} aria-labelledby={`aisle-${category}`}>
            <h2 id={`aisle-${category}`} className="mb-2 text-lg font-semibold">
              {t(`categories.${category}`)}
            </h2>
            <ul className="flex flex-col gap-2">
              {list.map((item) => (
                <GroceryItemRow
                  key={item.id}
                  item={item}
                  eventTitle={
                    item.associatedEventId ? titles.get(item.associatedEventId) : undefined
                  }
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
