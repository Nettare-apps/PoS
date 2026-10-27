import { describe, expect, it } from 'vitest';
import { MemoryEventLog } from '../events/log';
import { LibraryService } from '../library/service';
import { isPour, type Pour } from '../engine/types';
import { MemoryKV } from './kv';
import { LOCAL_HISTORY, LocalEventLog, LocalLibraryStore, loadInventory, loadWorking, saveWorking } from './local';

describe('LocalLibraryStore (on-device stand-in)', () => {
  it('seeds from the handoff data on first run and round-trips the draft', () => {
    const kv = new MemoryKV();
    const store = new LocalLibraryStore(kv);
    expect(store.getPublished().rev).toBe(1);
    expect(store.getDraft().products).toHaveLength(376);
    const service = new LibraryService(store, new MemoryEventLog());
    const draft = service.draft();
    (draft.products.find(isPour) as Pour).cost.frontline = 9999;
    service.saveDraft(draft, { user: '2222' });
    const again = new LocalLibraryStore(kv);
    expect((again.getDraft().products.find(isPour) as Pour).cost.frontline).toBe(9999);
    expect((again.getPublished().data.products.find(isPour) as Pour).cost.frontline).not.toBe(9999);
  });

  it(`keeps only the last ${LOCAL_HISTORY} revisions on this device`, () => {
    const kv = new MemoryKV();
    const service = new LibraryService(new LocalLibraryStore(kv), new MemoryEventLog());
    for (let i = 0; i < LOCAL_HISTORY + 3; i++) service.publish(service.draft(), { user: '2222' });
    const revs = new LocalLibraryStore(kv).history();
    expect(revs).toHaveLength(LOCAL_HISTORY);
    expect(revs[revs.length - 1]!.rev).toBe(LOCAL_HISTORY + 4);
    // appends must still chain from the kept head
    expect(service.publish(service.draft(), { user: '2222' }).rev).toBe(LOCAL_HISTORY + 5);
  });
});

describe('LocalEventLog', () => {
  it('persists events and prunes only uncommitted taps older than 30 days', () => {
    const kv = new MemoryKV();
    let now = new Date('2026-10-01T00:00:00Z');
    const log = new LocalEventLog(kv, () => now);
    log.append('library_publish', { user: '2222' }, { rev: 2 });
    log.tap('tap', { user: '2222' }, { label: 'Save draft' });
    now = new Date('2026-12-01T00:00:00Z'); // 61 days later
    const later = new LocalEventLog(kv, () => now);
    const types = later.all().map((e) => e.type);
    expect(types).toContain('library_publish');
    expect(types).not.toContain('tap');
  });
});

describe('working copy autosave and inventory', () => {
  it('round-trips', () => {
    const kv = new MemoryKV();
    expect(loadWorking(kv)).toBeNull();
    const store = new LocalLibraryStore(kv);
    const working = store.getDraft();
    working.categories.push('Scratch');
    saveWorking(kv, working);
    expect(loadWorking(kv)!.categories).toContain('Scratch');
    const inv = loadInventory(kv);
    expect(Object.keys(inv)).toHaveLength(256);
  });
});
