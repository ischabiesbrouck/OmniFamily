'use client';

import {
  Apple,
  Milk,
  Package,
  Plus,
  ShoppingBasket,
  Snowflake,
  SprayCan,
  Trash,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState, PageHeader } from '@/components/ui/Card';
import { getRepositories } from '@/lib/db/repositories';
import { clearPurchased, groupByCategory } from '@/lib/db/repositories/groceries';
import { useLiveRecords, useMembers } from '@/lib/db/repositories/hooks';
import type { GroceryCategory } from '@/lib/db/schema';
import { GroceryForm } from './GroceryForm';
import { GroceryItemRow } from './GroceryItemRow';

const AISLE_ICON: Record<GroceryCategory, LucideIcon> = {
  Produce: Apple,
  Dairy: Milk,
  Pantry: Package,
  Frozen: Snowflake,
  Household: SprayCan,
  Other: ShoppingBasket,
};

export function GroceryList() {
  const t = useTranslations('groceries');
  const items = useLiveRecords('grocery');
  const events = useLiveRecords('event');
  const members = useMembers() ?? [];
  const groups = groupByCategory(items ?? []);
  const titles = new Map((events ?? []).map((e) => [e.id, e.title]));
  const anyPurchased = (items ?? []).some((i) => i.purchased);
  const toBuy = (items ?? []).filter((i) => !i.purchased).length;

  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={t('toBuy', { count: toBuy })}
        visual={
          <span className="flex size-20 items-center justify-center rounded-full bg-glass shadow-card">
            <ShoppingBasket aria-hidden="true" className="size-9" />
          </span>
        }
        actions={
          anyPurchased && (
            <Button variant="primary" onClick={() => void clearPurchased(getRepositories().core)}>
              <Trash aria-hidden="true" className="size-5" />
              {t('clearPurchased')}
            </Button>
          )
        }
      />
      <div className="flex flex-col gap-4">
        <Card title={t('newItem')} icon={<Plus aria-hidden="true" className="size-5" />}>
          <GroceryForm fallbackMemberId={members[0]?.id ?? ''} />
        </Card>
        {groups.length === 0 ? (
          <EmptyState
            icon={<ShoppingBasket aria-hidden="true" className="size-6" />}
            title={t('empty')}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {groups.map(([category, list]) => {
              const Icon = AISLE_ICON[category];
              return (
                <Card
                  key={category}
                  title={t(`categories.${category}`)}
                  icon={<Icon aria-hidden="true" className="size-5" />}
                >
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
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
