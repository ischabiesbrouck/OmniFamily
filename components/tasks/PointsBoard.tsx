'use client';

import { useTranslations } from 'next-intl';
import { MemberAvatar } from '@/components/members/MemberAvatar';
import type { FamilyMember } from '@/lib/db/schema';

/** Points per person, highest first, with a bar relative to the leader. Text: "Lotte: 10 points". */
export function PointsBoard({
  members,
  totals,
}: {
  members: readonly FamilyMember[];
  totals: Map<string, number>;
}) {
  const t = useTranslations('tasks');
  const rows = members
    .filter((m) => m.role !== 'guest')
    .map((m) => ({ m, points: totals.get(m.id) ?? 0 }))
    .sort((a, b) => b.points - a.points || a.m.name.localeCompare(b.m.name));
  const top = Math.max(1, ...rows.map((r) => r.points));
  return (
    <ul className="flex flex-col gap-3">
      {rows.map(({ m, points }) => (
        <li key={m.id} className="flex items-center gap-3">
          <MemberAvatar member={m} size="sm" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm font-semibold">{t('balance', { name: m.name, points })}</span>
            <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-surface-2">
              <span
                className="block h-full rounded-full transition-[width] duration-200"
                style={{
                  width: `${(Math.max(points, 0) / top) * 100}%`,
                  backgroundColor: m.colorHex,
                }}
              />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
