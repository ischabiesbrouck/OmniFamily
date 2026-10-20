import type { FamilyMember } from '@/lib/db/schema';

/**
 * Data minimisation (GDPR Art. 5(1)(c), SPEC §7.2): family members' names are replaced by
 * tokens (P1, P2, …) before the snippet leaves the device, and mapped back locally.
 */
export interface Minimized {
  text: string;
  /** token → member id */
  tokens: Map<string, string>;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function minimize(
  text: string,
  members: readonly Pick<FamilyMember, 'id' | 'name'>[],
): Minimized {
  const tokens = new Map<string, string>();
  let out = text;
  // Longest names first, so "Anna-Lena" is replaced before "Anna".
  const byLength = [...members]
    .filter((m) => m.name.trim())
    .sort((a, b) => b.name.length - a.name.length);
  for (const member of byLength) {
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}])${escape(member.name.trim())}(?![\\p{L}\\p{N}])`,
      'giu',
    );
    if (!pattern.test(out)) continue;
    // Tokens count only the names that occur, so they reveal nothing about the family's size.
    const token = `P${tokens.size + 1}`;
    tokens.set(token, member.id);
    out = out.replace(pattern, token);
  }
  return { text: out, tokens };
}

/** Puts names back into provider text (e.g. a title "Swimming with P1"). */
export function restoreNames(
  text: string,
  tokens: ReadonlyMap<string, string>,
  members: readonly Pick<FamilyMember, 'id' | 'name'>[],
): string {
  return text.replace(/(?<![\p{L}\p{N}])P\d{1,2}(?![\p{L}\p{N}])/gu, (token) => {
    const id = tokens.get(token);
    return members.find((m) => m.id === id)?.name ?? token;
  });
}

export function restoreIds(ids: readonly string[], tokens: ReadonlyMap<string, string>): string[] {
  return [
    ...new Set(ids.map((id) => tokens.get(id)).filter((id): id is string => id !== undefined)),
  ];
}
