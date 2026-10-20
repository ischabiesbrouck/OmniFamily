/** Member colours: every swatch carries white text at ≥ 7:1 (WCAG 2.2 AAA, SPEC §6). */
export const MEMBER_COLORS = [
  { id: 'blue', hex: '#1e40af' },
  { id: 'red', hex: '#9f1239' },
  { id: 'green', hex: '#14532d' },
  { id: 'purple', hex: '#6b21a8' },
  { id: 'orange', hex: '#9a3412' },
  { id: 'teal', hex: '#134e4a' },
  { id: 'brown', hex: '#713f12' },
  { id: 'slate', hex: '#334155' },
] as const;

export type MemberColorId = (typeof MEMBER_COLORS)[number]['id'];

export function colorAt(index: number): (typeof MEMBER_COLORS)[number] {
  return MEMBER_COLORS[index % MEMBER_COLORS.length] ?? MEMBER_COLORS[0];
}
