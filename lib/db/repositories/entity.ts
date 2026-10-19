import type { Entity, NewRecord, RecordOf, RecordPatch, RepositoryCore } from './core';

/** CRUD for one syncable entity. Deletes are tombstones (SPEC D4). */
export interface EntityRepository<E extends Entity> {
  readonly entity: E;
  create(input: NewRecord<RecordOf<E>>): Promise<RecordOf<E>>;
  update(id: string, patch: RecordPatch<RecordOf<E>>): Promise<RecordOf<E>>;
  remove(id: string): Promise<void>;
  get(id: string): Promise<RecordOf<E> | undefined>;
  list(): Promise<RecordOf<E>[]>;
}

export function createEntityRepository<E extends Entity>(
  core: RepositoryCore,
  entity: E,
): EntityRepository<E> {
  return {
    entity,
    create: (input) => core.write([entity], (w) => w.insert(entity, input)),
    update: (id, patch) => core.write([entity], (w) => w.update(entity, id, patch)),
    remove: async (id) => {
      await core.write([entity], (w) => w.remove(entity, id));
    },
    get: (id) => core.get(entity, id),
    list: () => core.list(entity),
  };
}
