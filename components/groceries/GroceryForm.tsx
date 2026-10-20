'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
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
}: {
  eventId?: string;
  fallbackMemberId: string;
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
    } catch {
      setName(name);
      setQuantity(quantity);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-wrap items-end gap-2">
      <TextField
        className="min-w-40 flex-1"
        label={t('name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={error}
      />
      <TextField
        className="w-28"
        label={t('quantity')}
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
      />
      <Select
        label={t('category')}
        value={category}
        options={GROCERY_CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`) }))}
        onChange={(e) => setCategory(e.target.value as GroceryCategory)}
      />
      <Button type="submit">{t('add')}</Button>
    </form>
  );
}
