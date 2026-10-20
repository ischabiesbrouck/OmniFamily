'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import type { PinVerdict } from '@/lib/crypto/pin';
import { getRepositories } from '@/lib/db/repositories';
import { verifyMemberPin } from '@/lib/db/repositories/members';
import type { FamilyMember } from '@/lib/db/schema';

/** Gate for parent actions (SPEC §6). Calls `onSuccess` once the member's PIN verifies. */
export function PinPrompt({
  member,
  onSuccess,
  onCancel,
}: {
  member: Pick<FamilyMember, 'id' | 'name'>;
  onSuccess: () => void;
  onCancel?: () => void;
}) {
  const t = useTranslations('pin');
  const tCommon = useTranslations('common');
  const [pin, setPin] = useState('');
  const [verdict, setVerdict] = useState<PinVerdict | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await verifyMemberPin(getRepositories().core, member.id, pin);
    setBusy(false);
    setPin('');
    if (result.ok) {
      onSuccess();
      return;
    }
    setVerdict(result);
  }

  let message: string | undefined;
  if (verdict && !verdict.ok) {
    const wait = 'retryAt' in verdict ? Math.max(0, verdict.retryAt - Date.now()) : 0;
    if (verdict.reason === 'no_pin') message = t('noPin');
    else if (verdict.reason === 'locked')
      message = t('locked', { minutes: Math.ceil(wait / 60_000) });
    else if (verdict.reason === 'throttled' || wait > 0)
      message = t('throttled', { seconds: Math.ceil(wait / 1000) });
    else message = t('wrong');
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <TextField
        label={t('prompt', { name: member.name })}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
        inputMode="numeric"
        type="password"
        autoComplete="off"
        autoFocus
        error={message}
      />
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || pin.length < 4}>
          {t('submit')}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            {tCommon('cancel')}
          </Button>
        )}
      </div>
    </form>
  );
}
