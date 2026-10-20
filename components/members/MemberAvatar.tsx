import type { FamilyMember } from '@/lib/db/schema';

export function MemberAvatar({
  member,
  size = 'md',
}: {
  member: Pick<FamilyMember, 'name' | 'colorHex'>;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dims = { sm: 'size-8 text-sm', md: 'size-12 text-lg', lg: 'size-16 text-2xl' }[size];
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${dims}`}
      style={{ backgroundColor: member.colorHex }}
    >
      {member.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
