'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { ColorPicker } from '@/components/members/ColorPicker';
import { MemberAvatar } from '@/components/members/MemberAvatar';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { TextField } from '@/components/ui/TextField';
import { getRepositories } from '@/lib/db/repositories';
import { useMembers } from '@/lib/db/repositories/hooks';
import type { MemberRole } from '@/lib/db/schema';
import { colorAt, MEMBER_COLORS } from '@/lib/members/colors';
import { useDeviceStore } from '@/stores/deviceStore';

const NEW = 'new';
const ROLES: readonly MemberRole[] = ['parent', 'child', 'guest'];

/**
 * After joining, each device becomes one person's (D-10.9): pick an existing member, or add
 * yourself as a new one (an ordinary member write, so it syncs to the rest of the family).
 */
export function WhoAreYou({ onDone }: { onDone: () => void }) {
  const t = useTranslations('sync.who');
  const tRoles = useTranslations('roles');
  const members = useMembers() ?? [];
  const setActiveMember = useDeviceStore((s) => s.setActiveMember);
  const [choice, setChoice] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState<MemberRole>('parent');
  const used = new Set(members.map((m) => m.colorHex));
  const [color, setColor] = useState<string>(
    () => MEMBER_COLORS.find((c) => !used.has(c.hex))?.hex ?? colorAt(members.length).hex,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (choice === null || (choice === NEW && name.trim() === '')) {
      setError(t('required'));
      return;
    }
    setBusy(true);
    let id = choice;
    if (choice === NEW) {
      const created = await getRepositories().members.create({
        name: name.trim(),
        role,
        colorHex: color,
      });
      id = created.id;
    }
    setActiveMember(id);
    onDone();
  }

  const option =
    'flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 border-line bg-surface px-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft';

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-2xl font-semibold">{t('title')}</legend>
        <p className="mb-2">{t('intro')}</p>
        {members.map((m) => (
          <label key={m.id} className={option}>
            <input
              type="radio"
              name="who"
              value={m.id}
              checked={choice === m.id}
              onChange={() => setChoice(m.id)}
              className="size-5 accent-accent"
            />
            <MemberAvatar member={m} size="sm" />
            <span className="font-semibold">{m.name}</span>
            <span className="text-sm text-muted">{tRoles(m.role)}</span>
          </label>
        ))}
        <label className={option}>
          <input
            type="radio"
            name="who"
            value={NEW}
            checked={choice === NEW}
            onChange={() => setChoice(NEW)}
            className="size-5 accent-accent"
          />
          <span className="font-semibold">{t('newPerson')}</span>
        </label>
      </fieldset>

      {choice === NEW && (
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
          <TextField
            label={t('name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="given-name"
            autoFocus
          />
          <Select
            className="max-w-xs"
            label={t('role')}
            value={role}
            options={ROLES.map((r) => ({ value: r, label: tRoles(r) }))}
            onChange={(e) => setRole(e.target.value as MemberRole)}
          />
          <ColorPicker value={color} onChange={setColor} />
        </div>
      )}

      {error && (
        <p role="alert" className="font-medium text-danger">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy} className="min-h-14 w-full text-lg">
        {t('submit')}
      </Button>
    </form>
  );
}
