import { GROCERY_CATEGORIES, type GroceryCategory, type ParsedFamilyEntry } from '@/lib/db/schema';
import { instantToEpoch, isValidTimeZone } from '@/lib/time/zoned';

export const MAX_TEXT_LENGTH = 2_000;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** What the client sends. Member names are already replaced by tokens (§7.2). */
export interface IntakeRequest {
  text: string;
  /** Placeholder tokens standing in for family members, e.g. ["P1", "P2"]. */
  people: string[];
  timeZone: string;
  now: string;
  locale: string;
  image?: { mediaType: (typeof IMAGE_TYPES)[number]; data: string };
}

const str = (v: unknown, max = 500): v is string => typeof v === 'string' && v.length <= max;

export function validateIntakeRequest(value: unknown): IntakeRequest | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const v = value as Record<string, unknown>;
  if (!str(v.text, MAX_TEXT_LENGTH) || v.text.trim() === '') return undefined;
  if (!Array.isArray(v.people) || v.people.length > 50 || !v.people.every((p) => str(p, 8)))
    return undefined;
  if (!str(v.timeZone, 64) || !isValidTimeZone(v.timeZone)) return undefined;
  if (!str(v.now, 40) || !str(v.locale, 35)) return undefined;
  try {
    instantToEpoch(v.now);
  } catch {
    return undefined;
  }
  let image: IntakeRequest['image'];
  if (v.image !== undefined) {
    const img = v.image as Record<string, unknown>;
    const type = IMAGE_TYPES.find((t) => t === img?.mediaType);
    // base64 is 4/3 of the raw size
    if (!type || !str(img.data, Math.ceil((MAX_IMAGE_BYTES * 4) / 3))) return undefined;
    image = { mediaType: type, data: img.data };
  }
  return {
    text: v.text,
    people: v.people as string[],
    timeZone: v.timeZone,
    now: v.now,
    locale: v.locale,
    ...(image ? { image } : {}),
  };
}

/** Runtime check of a provider's answer; anything unexpected is rejected, never trusted. */
export function validateParsedEntry(value: unknown): ParsedFamilyEntry | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const v = value as Record<string, unknown>;
  if (!str(v.title, 200) || v.title.trim() === '') return undefined;
  if (!str(v.timeZone, 64) || !isValidTimeZone(v.timeZone)) return undefined;
  if (typeof v.isAllDay !== 'boolean') return undefined;
  if (!str(v.startInstant, 40) || !str(v.endInstant, 40)) return undefined;
  try {
    if (instantToEpoch(v.endInstant) < instantToEpoch(v.startInstant)) return undefined;
  } catch {
    return undefined;
  }
  if (typeof v.confidenceScore !== 'number' || v.confidenceScore < 0 || v.confidenceScore > 1)
    return undefined;
  if (!Array.isArray(v.assigneeIds) || !v.assigneeIds.every((a) => str(a, 64))) return undefined;
  if (v.location !== undefined && !str(v.location, 200)) return undefined;
  if (v.rawContextSnippet !== undefined && !str(v.rawContextSnippet, 500)) return undefined;

  const tasks = v.linkedTasks ?? [];
  if (!Array.isArray(tasks) || tasks.length > 20) return undefined;
  const linkedTasks: NonNullable<ParsedFamilyEntry['linkedTasks']> = [];
  for (const t of tasks as Array<Record<string, unknown>>) {
    if (!str(t?.title, 200) || (t.assigneeId !== undefined && !str(t.assigneeId, 64)))
      return undefined;
    linkedTasks.push({
      title: t.title,
      ...(t.assigneeId ? { assigneeId: t.assigneeId as string } : {}),
    });
  }
  const groceries = v.linkedGroceries ?? [];
  if (!Array.isArray(groceries) || groceries.length > 50) return undefined;
  const linkedGroceries: NonNullable<ParsedFamilyEntry['linkedGroceries']> = [];
  for (const g of groceries as Array<Record<string, unknown>>) {
    if (!str(g?.item, 100)) return undefined;
    const category = GROCERY_CATEGORIES.find((c) => c === g.category) as
      GroceryCategory | undefined;
    linkedGroceries.push({ item: g.item, ...(category ? { category } : {}) });
  }

  return {
    title: v.title,
    startInstant: v.startInstant,
    endInstant: v.endInstant,
    timeZone: v.timeZone,
    isAllDay: v.isAllDay,
    assigneeIds: v.assigneeIds as string[],
    confidenceScore: v.confidenceScore,
    ...(v.location ? { location: v.location as string } : {}),
    ...(linkedTasks.length ? { linkedTasks } : {}),
    ...(linkedGroceries.length ? { linkedGroceries } : {}),
    ...(v.rawContextSnippet ? { rawContextSnippet: v.rawContextSnippet as string } : {}),
  };
}
