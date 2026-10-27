/**
 * Draft → publish → revert (SPEC §1/§7): the register reads only the
 * published library; edits are drafts until published; every publish is a
 * kept revision, and reverting republishes an old revision — history is
 * never rewritten.
 */
import { describe, expect, it } from 'vitest';
import { MemoryEventLog } from '../events/log';
import { MemoryLibraryStore } from './memory';
import { LibraryService } from './service';
import type { LibraryData } from './types';
import { HH_DEFAULT_SCHEDULE } from '../engine/happyHour';
import type { Pour } from '../engine/types';

const pour = (price: number): Pour => ({
  kind: 'pour',
  id: 'p1',
  name: 'House Whisky',
  cats: ['Whisky'],
  primary: 'Whisky',
  size: 750,
  pack: 1,
  cost: { frontline: price, net: null, sale: null },
  basis: 'frontline',
  scale: { min: 15, max: 25 },
  servings: [{ qty: 1, unit: 'oz', target: 15, basis: 'frontline' }],
});

const mkLib = (frontline = 2170): LibraryData => ({
  products: [pour(frontline)],
  categories: ['Whisky'],
  settings: { unit: 'oz', parents: {}, hh: { schedule: HH_DEFAULT_SCHEDULE, menus: {} } },
  mods: { groups: [], menus: {}, items: {} },
});

function makeService() {
  const store = new MemoryLibraryStore(mkLib());
  const log = new MemoryEventLog(() => new Date('2026-10-27T03:00:00Z'));
  const service = new LibraryService(store, log, () => new Date('2026-10-27T03:00:00Z'));
  return { store, log, service };
}

const morgan = { user: '2222' };

describe('LibraryService', () => {
  it('a saved draft does NOT change what the register reads', () => {
    const { service } = makeService();
    service.saveDraft(mkLib(2500), morgan);
    expect((service.published().products[0] as Pour).cost.frontline).toBe(2170);
    expect((service.draft().products[0] as Pour).cost.frontline).toBe(2500);
    expect(service.pubState()).toMatchObject({ unpub: true });
  });

  it('publish makes the working copy both the draft and the published library, as a new revision', () => {
    const { service, log } = makeService();
    const rev = service.publish(mkLib(2500), morgan);
    expect(rev.rev).toBe(2);
    expect((service.published().products[0] as Pour).cost.frontline).toBe(2500);
    expect(service.pubState()).toMatchObject({ dirty: false, unpub: false, diffLive: false });
    expect(log.ofType('library_publish')[0]?.data).toMatchObject({ rev: 2 });
    expect(log.ofType('library_publish')[0]?.user).toBe('2222');
  });

  it('revert to published drops every change since the last publish, including the saved draft', () => {
    const { service } = makeService();
    service.saveDraft(mkLib(2500), morgan);
    const restored = service.revertToPublished(morgan);
    expect((restored.products[0] as Pour).cost.frontline).toBe(2170);
    expect(service.pubState()).toMatchObject({ unpub: false });
  });

  it('keeps every published revision and reverts by republishing — history is append-only', () => {
    const { service } = makeService();
    service.publish(mkLib(2500), morgan);
    service.publish(mkLib(3000), morgan);
    expect(service.history().map((r) => r.rev)).toEqual([1, 2, 3]);
    const back = service.revertToRevision(2, morgan);
    expect(back.rev).toBe(4);
    expect((service.published().products[0] as Pour).cost.frontline).toBe(2500);
    expect(service.history()).toHaveLength(4);
    expect(() => service.revertToRevision(99, morgan)).toThrow();
  });

  it('pubState mirrors the prototype publish bar (dirty / unpub / diffLive)', () => {
    const { service } = makeService();
    expect(service.pubState(mkLib(2600))).toMatchObject({ dirty: true, unpub: false, diffLive: true });
    service.saveDraft(mkLib(2600), morgan);
    expect(service.pubState(mkLib(2600))).toMatchObject({ dirty: false, unpub: true, diffLive: true });
  });

  it('returned data is defensively cloned', () => {
    const { service } = makeService();
    (service.published().products[0] as Pour).cost.frontline = 1;
    expect((service.published().products[0] as Pour).cost.frontline).toBe(2170);
  });

  it('logs every library action to the event log (SPEC §15)', () => {
    const { service, log } = makeService();
    service.saveDraft(mkLib(2500), morgan);
    service.publish(mkLib(2500), morgan);
    service.revertToPublished(morgan);
    service.revertToRevision(1, morgan);
    expect(log.ofType('library_save_draft')).toHaveLength(1);
    // revertToRevision republishes, so two publish events in all
    expect(log.ofType('library_publish')).toHaveLength(2);
    const reverts = log.ofType('library_revert');
    expect(reverts).toHaveLength(2);
    expect(reverts[0]?.data).toMatchObject({ toRev: 2 });
    expect(reverts[1]?.data).toMatchObject({ toRev: 1, publishedAs: 3 });
    for (const e of log.all()) expect(e.user).toBe('2222');
  });

  it('a failed publish leaves the draft and the log untouched', () => {
    const store = new MemoryLibraryStore(mkLib());
    const log = new MemoryEventLog();
    const failing = Object.create(store) as MemoryLibraryStore;
    failing.appendPublished = () => {
      throw new Error('store down');
    };
    const service = new LibraryService(failing, log);
    service.saveDraft(mkLib(2500), morgan);
    expect(() => service.publish(mkLib(3000), morgan)).toThrow('store down');
    expect((service.draft().products[0] as Pour).cost.frontline).toBe(2500);
    expect(log.ofType('library_publish')).toHaveLength(0);
    expect(service.history()).toHaveLength(1);
  });

  it('pubState is not fooled by normalization: a working copy that only normalization changes is clean', () => {
    const { service } = makeService();
    const working = mkLib();
    working.products[0]!.primary = 'Gone'; // normalization snaps this back to Whisky
    service.saveDraft(working, morgan);
    expect(service.pubState(working)).toMatchObject({ dirty: false });
  });

  it('normalizes on save: primary snaps back into cats, serving bases fill in', () => {
    const { service } = makeService();
    const lib = mkLib();
    lib.products[0]!.primary = 'Gone';
    (lib.products[0] as Pour).servings[0]!.basis = undefined as never;
    service.saveDraft(lib, morgan);
    const saved = service.draft().products[0] as Pour;
    expect(saved.primary).toBe('Whisky');
    expect(saved.servings[0]!.basis).toBe('frontline');
  });
});

describe('MemoryEventLog', () => {
  it('appends frozen events with ts/type/user/tab and never exposes mutation', () => {
    const log = new MemoryEventLog(() => new Date('2026-10-27T03:00:00Z'));
    const payload = { note: 'x', nested: { amount: 100 } };
    const e = log.append('library_save_draft', { user: '1111', tab: null }, payload);
    expect(e).toMatchObject({ type: 'library_save_draft', user: '1111', tab: null });
    expect(e.ts).toBe('2026-10-27T03:00:00.000Z');
    expect(Object.isFrozen(e)).toBe(true);
    expect(Object.isFrozen(e.data)).toBe(true);
    // an appended event is detached from the caller's objects and deep-frozen
    payload.nested.amount = 999;
    expect((e.data as { nested: { amount: number } }).nested.amount).toBe(100);
    expect(Object.isFrozen(e.data['nested'])).toBe(true);
    const all = log.all();
    expect(all).toHaveLength(1);
    // the returned list is a copy; the log itself has no delete or update
    (all as unknown[]).pop();
    expect(log.all()).toHaveLength(1);
    const keys = Object.getOwnPropertyNames(Object.getPrototypeOf(log)).filter((k) => k !== 'constructor');
    expect(keys.sort()).toEqual(['all', 'append', 'ofType']);
  });
});
