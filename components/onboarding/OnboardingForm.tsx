'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ColorPicker } from '@/components/members/ColorPicker';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { TextField } from '@/components/ui/TextField';
import { isValidPin } from '@/lib/crypto/pin';
import { getRepositories } from '@/lib/db/repositories';
import { createHousehold, type NewMemberInput } from '@/lib/db/repositories/household';
import type { MemberRole } from '@/lib/db/schema';
import { colorAt } from '@/lib/members/colors';
import { useDeviceStore } from '@/stores/deviceStore';

interface DraftMember {
  key: number;
  name: string;
  role: MemberRole;
  colorHex: string;
}

const ROLES: readonly MemberRole[] = ['parent', 'child', 'guest'];

export function OnboardingForm() {
  const t = useTranslations('onboarding');
  const tRoles = useTranslations('roles');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const setActiveMember = useDeviceStore((s) => s.setActiveMember);

  const [householdName, setHouseholdName] = useState(() => t('defaultHouseholdName'));
  const [deviceName, setDeviceName] = useState(() => t('defaultDeviceName'));
  const [yourName, setYourName] = useState('');
  const [color, setColor] = useState<string>(colorAt(0).hex);
  const [pin, setPin] = useState('');
  const [others, setOthers] = useState<DraftMember[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const nameError = submitted && yourName.trim() === '' ? t('errors.nameRequired') : undefined;
  const pinError = submitted && pin !== '' && !isValidPin(pin) ? t('errors.pinInvalid') : undefined;
  const otherErrors = others.map((m) =>
    submitted && m.name.trim() === '' ? t('errors.nameRequired') : undefined,
  );

  const roleOptions = ROLES.map((r) => ({ value: r, label: tRoles(r) }));

  function updateOther(key: number, patch: Partial<DraftMember>) {
    setOthers((list) => list.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setFailure(null);
    if (yourName.trim() === '' || (pin !== '' && !isValidPin(pin))) return;
    if (others.some((m) => m.name.trim() === '')) return;

    setBusy(true);
    try {
      const founder: NewMemberInput = {
        name: yourName,
        colorHex: color,
        role: 'parent',
        pin: pin || undefined,
      };
      const { members } = await createHousehold(getRepositories().core, {
        householdName: householdName.trim() || t('defaultHouseholdName'),
        deviceName: deviceName.trim() || t('defaultDeviceName'),
        members: [founder, ...others.map(({ name, role, colorHex }) => ({ name, role, colorHex }))],
      });
      setActiveMember(members[0]?.id ?? null);
      router.replace('/');
    } catch (error) {
      setFailure(
        t('errors.failed', { message: error instanceof Error ? error.message : String(error) }),
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <TextField
        label={t('yourName')}
        value={yourName}
        onChange={(e) => setYourName(e.target.value)}
        autoComplete="given-name"
        autoFocus
        required
        error={nameError}
      />
      <ColorPicker value={color} onChange={setColor} />
      <TextField
        label={t('householdName')}
        value={householdName}
        onChange={(e) => setHouseholdName(e.target.value)}
      />
      <TextField
        label={`${t('pin')} (${tCommon('optional')})`}
        hint={t('pinHint')}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
        inputMode="numeric"
        autoComplete="new-password"
        type="password"
        error={pinError}
      />

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-lg font-semibold">{t('otherMembers')}</legend>
        {others.map((m, index) => (
          <div key={m.key} className="flex flex-wrap items-end gap-2">
            <TextField
              className="min-w-40 flex-1"
              label={t('memberName')}
              value={m.name}
              onChange={(e) => updateOther(m.key, { name: e.target.value })}
              error={otherErrors[index]}
            />
            <Select
              label={t('role')}
              value={m.role}
              options={roleOptions}
              onChange={(e) => updateOther(m.key, { role: e.target.value as MemberRole })}
            />
            <Button
              variant="ghost"
              aria-label={t('removeMember', { name: m.name || t('memberName') })}
              onClick={() => setOthers((list) => list.filter((o) => o.key !== m.key))}
            >
              {tCommon('remove')}
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          className="self-start"
          onClick={() =>
            setOthers((list) => [
              ...list,
              { key: Date.now(), name: '', role: 'child', colorHex: colorAt(list.length + 1).hex },
            ])
          }
        >
          {t('addMember')}
        </Button>
      </fieldset>

      <TextField
        label={t('deviceName')}
        value={deviceName}
        onChange={(e) => setDeviceName(e.target.value)}
      />

      <section
        aria-labelledby="security-title"
        className="border-ink/20 rounded-lg border p-4 text-sm"
      >
        <h2 id="security-title" className="mb-1 font-semibold">
          {t('securityTitle')}
        </h2>
        <p>{t('pinDisclosure')}</p>
        <p>{t('storageDisclosure')}</p>
      </section>

      {failure && (
        <p role="alert" className="text-danger font-medium">
          {failure}
        </p>
      )}
      <Button type="submit" disabled={busy} className="text-lg">
        {busy ? t('creating') : t('submit')}
      </Button>
    </form>
  );
}
