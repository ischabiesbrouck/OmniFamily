import type { FamilyMember } from '@/lib/db/schema';

export function MemberAvatar({
  member,
  size = 'md',
}: {
  member: Pick<FamilyMember, 'name' | 'colorHex'>;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dims = { sm: 'size-8 text-sm', md: 'size-11 text-base', lg: 'size-16 text-2xl' }[size];
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-surface ${dims}`}
      style={{ backgroundColor: member.colorHex }}
    >
      {member.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
