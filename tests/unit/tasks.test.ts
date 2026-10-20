import { describe, expect, it } from 'vitest';
import { createEvent, type EventDraft } from '@/lib/db/repositories/events';
import {
  addGrocery,
  clearPurchased,
  groupByCategory,
  removeGrocery,
  setPurchased,
} from '@/lib/db/repositories/groceries';
import { adjustPoints, balances } from '@/lib/db/repositories/points';
import {
  createTask,
  deleteTask,
  progressFor,
  setTaskCompleted,
  taskProgressByEvent,
  updateTask,
  validateTaskDraft,
} from '@/lib/db/repositories/tasks';
import { setupRepositories } from './helpers';

const AMS = 'Europe/Amsterdam';
const eventDraft: EventDraft = {
  title: 'Birthday party',
  description: '',
  location: '',
  isAllDay: false,
  date: '2026-10-31',
  endDate: '2026-10-31',
  startTime: '14:00',
  endTime: '17:00',
  timeZone: AMS,
  memberIds: [],
  visibility: 'family',
  repeat: 'none',
  createdById: 'parent',
};

describe('acceptance: completing a linked task (Phase 4)', () => {
  it('writes a ledger entry and updates the event badge', async () => {
    const { db, repos } = setupRepositories();
    const event = await createEvent(repos.core, eventDraft);
    const task = await createTask(repos.core, {
      title: 'Wrap the present',
      timeZone: AMS,
      assigneeId: 'child',
      pointsValue: 10,
      eventId: event.id,
    });
    await createTask(repos.core, { title: 'Buy balloons', timeZone: AMS, eventId: event.id });

    expect((await repos.events.get(event.id))?.linkedTaskIds?.sort()).toHaveLength(2);
    const before = progressFor(event, taskProgressByEvent(await repos.tasks.list()));
    expect(before).toEqual({ done: 0, total: 2 });

    const { ledger } = await setTaskCompleted(repos.core, task.id, true, 'parent');

    expect(ledger).toMatchObject({
      memberId: 'child',
      delta: 10,
      reason: 'task_completed',
      taskId: task.id,
    });
    expect(await repos.points.list()).toHaveLength(1);
    expect(balances(await repos.points.list()).get('child')).toBe(10);
    const after = progressFor(event, taskProgressByEvent(await repos.tasks.list()));
    expect(after).toEqual({ done: 1, total: 2 });

    const completed = await repos.tasks.get(task.id);
    expect(completed).toMatchObject({ completed: true, completedBy: 'parent' });
    // task update and ledger insert were written in one transaction, each with an outbox row
    const ops = (await db.outbox.toArray()).slice(-2).map((r) => [r.entity, r.op]);
    expect(ops).toEqual([
      ['task', 'update'],
      ['points', 'insert'],
    ]);
  });
});

describe('tasks and points ledger', () => {
  it('completing twice is idempotent; reopening appends a reversal', async () => {
    const { repos } = setupRepositories();
    const task = await createTask(repos.core, {
      title: 'Dishes',
      timeZone: AMS,
      assigneeId: 'kid',
      pointsValue: 3,
    });
    await setTaskCompleted(repos.core, task.id, true, 'kid');
    const again = await setTaskCompleted(repos.core, task.id, true, 'kid');
    expect(again.ledger).toBeUndefined();
    await setTaskCompleted(repos.core, task.id, false, 'kid');

    const entries = await repos.points.list();
    expect(entries.map((e) => e.delta)).toEqual([3, -3]);
    expect(balances(entries).get('kid')).toBe(0);
    expect((await repos.tasks.get(task.id))?.completedAt).toBeUndefined();
  });

  it('credits whoever ticked an unassigned chore', async () => {
    const { repos } = setupRepositories();
    const task = await createTask(repos.core, {
      title: 'Walk the dog',
      timeZone: AMS,
      pointsValue: 2,
    });
    const { ledger } = await setTaskCompleted(repos.core, task.id, true, 'sem');
    expect(ledger?.memberId).toBe('sem');
  });

  it('tasks without points never touch the ledger', async () => {
    const { repos } = setupRepositories();
    const task = await createTask(repos.core, {
      title: 'Call the plumber',
      timeZone: AMS,
      assigneeId: 'mum',
    });
    await setTaskCompleted(repos.core, task.id, true, 'mum');
    expect(await repos.points.list()).toEqual([]);
  });

  it('stores a due date as an instant at the end of that day in its zone', async () => {
    const { repos } = setupRepositories();
    const task = await createTask(repos.core, {
      title: 'Return library books',
      timeZone: AMS,
      dueDate: '2026-10-25',
    });
    expect(task.dueInstant).toBe('2026-10-25T22:59:00.000Z'); // 23:59 CET
    expect(task.timeZone).toBe(AMS);
    const timed = await createTask(repos.core, {
      title: 'Dentist',
      timeZone: AMS,
      dueDate: '2026-10-24',
      dueTime: '09:30',
    });
    expect(timed.dueInstant).toBe('2026-10-24T07:30:00.000Z');
  });

  it('validates drafts', () => {
    expect(validateTaskDraft({ title: '', timeZone: AMS })).toBe('titleRequired');
    expect(validateTaskDraft({ title: 'x', timeZone: AMS, dueDate: '2026-02-31' })).toBe(
      'invalidDue',
    );
    expect(validateTaskDraft({ title: 'x', timeZone: AMS, pointsValue: -1 })).toBe('invalidPoints');
    expect(validateTaskDraft({ title: 'x', timeZone: AMS, pointsValue: 5 })).toBeUndefined();
  });

  it('moving or deleting a task keeps the event links in step', async () => {
    const { repos } = setupRepositories();
    const a = await createEvent(repos.core, eventDraft);
    const b = await createEvent(repos.core, { ...eventDraft, title: 'Other' });
    const task = await createTask(repos.core, { title: 'Bake cake', timeZone: AMS, eventId: a.id });
    await updateTask(repos.core, task, { title: 'Bake cake', timeZone: AMS, eventId: b.id });
    expect((await repos.events.get(a.id))?.linkedTaskIds).toEqual([]);
    expect((await repos.events.get(b.id))?.linkedTaskIds).toEqual([task.id]);
    await deleteTask(repos.core, task.id);
    expect((await repos.events.get(b.id))?.linkedTaskIds).toEqual([]);
  });

  it('records manual adjustments and redemptions as ledger entries', async () => {
    const { repos } = setupRepositories();
    await adjustPoints(repos.core, 'kid', 20, 'manual_adjustment');
    await adjustPoints(repos.core, 'kid', -15, 'reward_redeemed');
    expect(balances(await repos.points.list()).get('kid')).toBe(5);
    expect(() => adjustPoints(repos.core, 'kid', 0, 'manual_adjustment')).toThrow(RangeError);
  });
});

describe('groceries', () => {
  it('adds, links to an event, ticks off and clears purchased items', async () => {
    const { repos } = setupRepositories();
    const party = await createEvent(repos.core, eventDraft);
    const cake = await addGrocery(repos.core, {
      name: 'Flour',
      category: 'Pantry',
      addedByMemberId: 'p',
      associatedEventId: party.id,
    });
    const milk = await addGrocery(repos.core, {
      name: 'Milk',
      category: 'Dairy',
      quantity: '2 L',
      addedByMemberId: 'p',
    });
    await addGrocery(repos.core, { name: 'Apples', category: 'Produce', addedByMemberId: 'p' });
    expect((await repos.events.get(party.id))?.linkedGroceryIds).toEqual([cake.id]);

    expect(
      groupByCategory(await repos.groceries.list()).map(([c, list]) => [
        c,
        list.map((i) => i.name),
      ]),
    ).toEqual([
      ['Produce', ['Apples']],
      ['Dairy', ['Milk']],
      ['Pantry', ['Flour']],
    ]);

    await setPurchased(repos.core, cake.id, true);
    await setPurchased(repos.core, milk.id, true);
    expect(await clearPurchased(repos.core)).toBe(2);
    expect((await repos.groceries.list()).map((g) => g.name)).toEqual(['Apples']);
    expect((await repos.events.get(party.id))?.linkedGroceryIds).toEqual([]);
  });

  it('removing an item is a tombstone', async () => {
    const { db, repos } = setupRepositories();
    const item = await addGrocery(repos.core, {
      name: 'Soap',
      category: 'Household',
      addedByMemberId: 'p',
    });
    await removeGrocery(repos.core, item.id);
    expect(await repos.groceries.list()).toEqual([]);
    expect((await db.groceries.get(item.id))?.deletedAt).toBeDefined();
  });
});
