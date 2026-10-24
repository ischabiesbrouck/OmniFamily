'use client';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { TextField } from '@/components/ui/TextField';
import { isValidPin } from '@/lib/crypto/pin';
import { getRepositories } from '@/lib/db/repositories';
import { useMembers } from '@/lib/db/repositories/hooks';
import { hasPin, setMemberPin } from '@/lib/db/repositories/members';
import type { FamilyMember, MemberRole } from '@/lib/db/schema';
import { colorAt } from '@/lib/members/colors';
import { useDeviceStore } from '@/stores/deviceStore';
import { ColorPicker } from './ColorPicker';
import { MemberAvatar } from './MemberAvatar';

const ROLES: readonly MemberRole[] = ['parent', 'child', 'guest'];

function PinEditor({ member, onDone }: { member: FamilyMember; onDone: () => void }) {
  const t = useTranslations();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | undefined>();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isValidPin(pin)) {
      setError(t('onboarding.errors.pinInvalid'));
      return;
    }
    await setMemberPin(getRepositories().core, member.id, pin);
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      <TextField
        label={t('settings.newPin')}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
        inputMode="numeric"
        type="password"
        autoComplete="new-password"
        autoFocus
        error={error}
      />
      <Button type="submit">{t('common.save')}</Button>
      <Button variant="ghost" onClick={onDone}>
        {t('common.cancel')}
      </Button>
    </form>
  );
}

function AddMemberForm({ nextColor }: { nextColor: string }) {
  const t = useTranslations();
  const [name, setName] = useState('');
  const [role, setRole] = useState<MemberRole>('child');
  const [color, setColor] = useState(nextColor);
  const [error, setError] = useState<string | undefined>();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (name.trim() === '') {
      setError(t('onboarding.errors.nameRequired'));
      return;
    }
    // Clear at once so typing the next name is never overwritten (D-8.5).
    const typed = name;
    setName('');
    setError(undefined);
    try {
      await getRepositories().members.create({ name: typed.trim(), role, colorHex: color });
    } catch {
      setName(typed);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-tile bg-surface-2 p-4">
      <h3 className="font-semibold">{t('settings.addMember')}</h3>
      <div className="flex flex-wrap items-start gap-2">
        <TextField
          inline
          className="min-w-40 flex-1"
          label={t('onboarding.memberName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
        />
        <Select
          inline
          label={t('onboarding.role')}
          value={role}
          options={ROLES.map((r) => ({ value: r, label: t(`roles.${r}`) }))}
          onChange={(e) => setRole(e.target.value as MemberRole)}
        />
      </div>
      <ColorPicker value={color} onChange={setColor} />
      <Button type="submit" className="self-start">
        {t('common.add')}
      </Button>
    </form>
  );
}

export function MemberSettings() {
  const t = useTranslations();
  const members = useMembers();
  const activeId = useDeviceStore((s) => s.activeMemberId);
  const setActiveMember = useDeviceStore((s) => s.setActiveMember);
  const [editingPin, setEditingPin] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!members) return <p role="status">{t('common.loading')}</p>;
  const parents = members.filter((m) => m.role === 'parent');

  async function remove(member: FamilyMember) {
    if (member.role === 'parent' && parents.length <= 1) {
      setNotice(t('settings.lastParent'));
      return;
    }
    if (!window.confirm(t('settings.removeMemberConfirm', { name: member.name }))) return;
    await getRepositories().members.remove(member.id);
    if (activeId === member.id) setActiveMember(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <Select
        label={t('settings.thisDevice')}
        value={activeId ?? ''}
        options={[
          { value: '', label: '—' },
          ...members.map((m) => ({ value: m.id, label: m.name })),
        ]}
        onChange={(e) => setActiveMember(e.target.value || null)}
      />

      {notice && (
        <p role="alert" className="font-medium text-danger">
          {notice}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {members.map((m) => (
          <li key={m.id} className="flex flex-col gap-2 rounded-tile bg-surface-2 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <MemberAvatar member={m} />
              <div className="flex flex-1 flex-col">
                <span className="font-semibold">{m.name}</span>
                <span className="text-sm text-muted">
                  {t(`roles.${m.role}`)} ·{' '}
                  {hasPin(m) ? t('settings.pinSet') : t('settings.pinNone')}
                </span>
              </div>
              <Button variant="soft" onClick={() => setEditingPin(m.id)}>
                {hasPin(m) ? t('settings.changePin') : t('settings.setPin')}
              </Button>
              {hasPin(m) && (
                <Button
                  variant="ghost"
                  onClick={() => void setMemberPin(getRepositories().core, m.id, null)}
                >
                  {t('settings.clearPin')}
                </Button>
              )}
              <IconButton
                label={t('onboarding.removeMember', { name: m.name })}
                onClick={() => void remove(m)}
              >
                <Trash2 aria-hidden="true" className="size-5 text-danger" />
              </IconButton>
            </div>
            {editingPin === m.id && <PinEditor member={m} onDone={() => setEditingPin(null)} />}
          </li>
        ))}
      </ul>

      <AddMemberForm key={members.length} nextColor={colorAt(members.length).hex} />
    </div>
  );
}
