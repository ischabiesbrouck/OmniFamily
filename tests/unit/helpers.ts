import { NexusDB } from '@/lib/db/schema';
import { createRepositories, type Repositories } from '@/lib/db/repositories';

let counter = 0;

/** A fresh, isolated database plus repositories driven by a controllable clock. */
export function setupRepositories(start = Date.UTC(2026, 9, 19, 12)): {
  db: NexusDB;
  repos: Repositories;
  clock: { now: number };
} {
  const clock = { now: start };
  counter += 1;
  const db = new NexusDB(`test-${counter}-${Math.random().toString(36).slice(2)}`);
  const repos = createRepositories(db, { now: () => clock.now });
  return { db, repos, clock };
}
