import { GROCERY_CATEGORIES, type GroceryCategory, type GroceryItem } from '../schema';
import type { RepositoryCore, Writer } from './core';

export interface GroceryDraft {
  name: string;
  category: GroceryCategory;
  quantity?: string | undefined;
  addedByMemberId: string;
  associatedEventId?: string | undefined;
}

async function relinkEvent(
  w: Writer,
  eventId: string | undefined,
  itemId: string,
  linked: boolean,
) {
  if (!eventId) return;
  const event = await w.get('event', eventId);
  if (!event || event.deletedAt !== undefined) return;
  const ids = new Set(event.linkedGroceryIds ?? []);
  if (linked) ids.add(itemId);
  else ids.delete(itemId);
  await w.update('event', eventId, { linkedGroceryIds: [...ids] });
}

export function addGrocery(core: RepositoryCore, draft: GroceryDraft): Promise<GroceryItem> {
  if (draft.name.trim() === '') throw new RangeError('name required');
  return core.write(['grocery', 'event'], async (w) => {
    const item = await w.insert('grocery', {
      name: draft.name.trim(),
      category: draft.category,
      quantity: draft.quantity?.trim() || undefined,
      purchased: false,
      addedByMemberId: draft.addedByMemberId,
      associatedEventId: draft.associatedEventId || undefined,
    });
    await relinkEvent(w, item.associatedEventId, item.id, true);
    return item;
  });
}

export function setPurchased(
  core: RepositoryCore,
  id: string,
  purchased: boolean,
): Promise<GroceryItem> {
  return core.write(['grocery'], (w) => w.update('grocery', id, { purchased }));
}

export function removeGrocery(core: RepositoryCore, id: string): Promise<void> {
  return core.write(['grocery', 'event'], async (w) => {
    const removed = await w.remove('grocery', id);
    await relinkEvent(w, removed.associatedEventId, id, false);
  });
}

/** Tombstones every purchased item in one transaction. */
export function clearPurchased(core: RepositoryCore): Promise<number> {
  return core.write(['grocery', 'event'], async (w) => {
    const purchased = await core.db.groceries
      .filter((g) => g.purchased && g.deletedAt === undefined)
      .toArray();
    for (const item of purchased) {
      await w.remove('grocery', item.id);
      await relinkEvent(w, item.associatedEventId, item.id, false);
    }
    return purchased.length;
  });
}

/** Items grouped in aisle order; open items first within each group. */
export function groupByCategory(
  items: readonly GroceryItem[],
): Array<[GroceryCategory, GroceryItem[]]> {
  return GROCERY_CATEGORIES.map((category): [GroceryCategory, GroceryItem[]] => [
    category,
    items
      .filter((i) => i.category === category && i.deletedAt === undefined)
      .sort((a, b) => Number(a.purchased) - Number(b.purchased) || a.name.localeCompare(b.name)),
  ]).filter(([, list]) => list.length > 0);
}
