'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { MEMBER_COLORS } from '@/lib/members/colors';

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const t = useTranslations('colors');
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="font-medium">{t('label')}</legend>
      <div className="flex flex-wrap gap-1">
        {MEMBER_COLORS.map((c) => (
          <label
            key={c.id}
            className="relative inline-flex size-12 cursor-pointer items-center justify-center"
          >
            <input
              type="radio"
              name={name}
              value={c.hex}
              checked={value === c.hex}
              onChange={() => onChange(c.hex)}
              className="peer sr-only"
            />
            <span className="sr-only">{t(c.id)}</span>
            <span
              aria-hidden="true"
              className="size-9 rounded-full ring-offset-2 peer-checked:ring-4 peer-checked:ring-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-focus"
              style={{ backgroundColor: c.hex }}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
