'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import type { Entity, RecordOf } from './core';
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
