'use client';

import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { MemberAvatar } from '@/components/members/MemberAvatar';
import { PinPrompt } from '@/components/members/PinPrompt';
import { Button } from '@/components/ui/Button';
import { useMembers } from '@/lib/db/repositories/hooks';
import { hasPin } from '@/lib/db/repositories/members';

/**
 * Parent-only areas. Open when no parent has a PIN; otherwise one parent's PIN unlocks it
 * until the component unmounts (navigation re-locks it).
 */
export function ParentGate({ children }: { children: ReactNode }) {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const members = useMembers();
  const [unlocked, setUnlocked] = useState(false);
  const [chosenId, setChosenId] = useState<string | null>(null);

  if (!members) return <p role="status">{tCommon('loading')}</p>;
  const lockedParents = members.filter((m) => m.role === 'parent' && hasPin(m));
  if (!unlocked && lockedParents.length === 0) {
    // Open on arrival means open for this visit, even after a PIN is set inside it.
    setUnlocked(true);
  }
  if (unlocked || lockedParents.length === 0) return <>{children}</>;

  const chosen = lockedParents.find((m) => m.id === chosenId);
  if (chosen) {
    return (
      <div className="mx-auto max-w-sm">
        <PinPrompt
          member={chosen}
          onSuccess={() => setUnlocked(true)}
          onCancel={() => setChosenId(null)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-3">
      <p>{t('parentGate')}</p>
      {lockedParents.map((m) => (
        <Button
          key={m.id}
          variant="secondary"
          className="justify-start"
          onClick={() => setChosenId(m.id)}
        >
          <MemberAvatar member={m} size="sm" />
          {t('unlockAs', { name: m.name })}
        </Button>
      ))}
    </div>
  );
}
