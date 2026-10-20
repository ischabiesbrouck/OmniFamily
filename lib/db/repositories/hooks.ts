'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import type { FamilyEvent, FamilyMember, HouseholdContext } from '../schema';
import type { Entity, RecordOf } from './core';
import { getHousehold } from './household';
import { getRepositories } from './index';

/** Live list of non-tombstoned records; `undefined` while the first query is in flight. */
export function useLiveRecords<E extends Entity>(entity: E): RecordOf<E>[] | undefined {
  return useLiveQuery(() => getRepositories().core.list(entity), [entity]);
}

export function useLiveRecord<E extends Entity>(
  entity: E,
  id: string | undefined,
): RecordOf<E> | undefined {
  return useLiveQuery(
    () => (id === undefined ? undefined : getRepositories().core.get(entity, id)),
    [entity, id],
  );
}

/** `undefined` while loading, `null` when this device has no household yet. */
export function useHousehold(): HouseholdContext | null | undefined {
  return useLiveQuery(async () => (await getHousehold(getRepositories().core.db)) ?? null, []);
}

/** Members in creation order (HLC order is creation order on one device). */
export function useMembers(): FamilyMember[] | undefined {
  const members = useLiveRecords('member');
  return members?.slice().sort((a, b) => (a.hlc < b.hlc ? -1 : 1));
}

export function useLiveEvents(): FamilyEvent[] | undefined {
  return useLiveRecords('event');
}

/** A device-local setting; `undefined` while loading. */
export function useSetting(key: string): unknown {
  return useLiveQuery(
    async () => (await getRepositories().core.db.settings.get(key))?.value ?? null,
    [key],
  );
}
