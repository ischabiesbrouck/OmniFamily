'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { TextField } from '@/components/ui/TextField';
import { getRepositories } from '@/lib/db/repositories';
import { addGrocery } from '@/lib/db/repositories/groceries';
import { GROCERY_CATEGORIES, type GroceryCategory } from '@/lib/db/schema';
import { useDeviceStore } from '@/stores/deviceStore';

export function GroceryForm({
  eventId,
  fallbackMemberId,
  onAdded,
}: {
  eventId?: string;
  fallbackMemberId: string;
  onAdded?: () => void;
}) {
  const t = useTranslations('groceries');
  const activeMemberId = useDeviceStore((s) => s.activeMemberId);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [category, setCategory] = useState<GroceryCategory>('Other');
  const [error, setError] = useState<string | undefined>();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (name.trim() === '') {
      setError(t('errors.nameRequired'));
      return;
    }
    // Clear at once so the next item can be typed while this one is written (D-8.5).
    setName('');
    setQuantity('');
    setError(undefined);
    try {
      await addGrocery(getRepositories().core, {
        name,
        quantity,
        category,
        addedByMemberId: activeMemberId ?? fallbackMemberId,
        associatedEventId: eventId,
      });
      onAdded?.();
    } catch {
      setName(name);
      setQuantity(quantity);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <TextField
          inline
          className="min-w-0 flex-1"
          label={t('name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
        />
        <Button type="submit" className="min-h-14 shrink-0">
          <Plus aria-hidden="true" className="size-5" />
          {t('add')}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <TextField
          inline
          label={t('quantity')}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <Select
          inline
          label={t('category')}
          value={category}
          options={GROCERY_CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`) }))}
          onChange={(e) => setCategory(e.target.value as GroceryCategory)}
        />
      </div>
    </form>
  );
}
