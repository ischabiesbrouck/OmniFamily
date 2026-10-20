'use client';

import { useTranslations } from 'next-intl';
import { MemberAvatar } from '@/components/members/MemberAvatar';
import { useMembers } from '@/lib/db/repositories/hooks';
import { useDeviceStore } from '@/stores/deviceStore';

export default function TodayPage() {
  const t = useTranslations('today');
  const members = useMembers();
  const activeId = useDeviceStore((s) => s.activeMemberId);
  const active = members?.find((m) => m.id === activeId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">
        {active ? t('greeting', { name: active.name }) : t('greetingAnonymous')}
      </h1>
      <section aria-labelledby="family-heading">
        <h2 id="family-heading" className="mb-2 text-lg font-semibold">
          {t('members')}
        </h2>
        <ul className="flex flex-wrap gap-4">
          {members?.map((m) => (
            <li key={m.id} className="flex items-center gap-2">
              <MemberAvatar member={m} />
              <span>{m.name}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
