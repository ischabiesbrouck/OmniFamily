import { NexusDB } from '../schema';
import { RepositoryCore, type CoreOptions } from './core';
import { createEntityRepository } from './entity';

export function createRepositories(db: NexusDB, options: CoreOptions = {}) {
  const core = new RepositoryCore(db, options);
  return {
    core,
    events: createEntityRepository(core, 'event'),
    tasks: createEntityRepository(core, 'task'),
    groceries: createEntityRepository(core, 'grocery'),
    members: createEntityRepository(core, 'member'),
    devices: createEntityRepository(core, 'device'),
    points: createEntityRepository(core, 'points'),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

let instance: Repositories | undefined;

/** App-wide repositories over the browser IndexedDB. Dexie opens lazily on first query. */
export function getRepositories(): Repositories {
  instance ??= createRepositories(new NexusDB());
  return instance;
}

export { RecordNotFoundError } from './core';
export type { NewRecord, RecordPatch, Writer } from './core';
