/**
 * On-device storage adapters — a STAND-IN until the backend decision lands
 * (no Supabase project exists yet; that is Conner's call). Single device,
 * seeded from data/pos_data.json on first run. The domain services don't
 * know the difference, so swapping in the real backend is an adapter change.
 *
 * Local limits, stated rather than hidden:
 * - Revision history keeps the most recent LOCAL_HISTORY revisions on this
 *   device (localStorage quota); the real backend keeps 30 days (SPEC §7).
 * - Tap events (committed:false) older than 30 days are pruned on load —
 *   exactly the discard window Conner set on 2026-10-27. Committed events
 *   are never pruned here.
 */
import type { EventLog, EventSource } from '../events/log';
import type { EventContext, PourEvent } from '../events/types';
import { deepClone } from '../library/normalize';
import { seedInventory, seedLibrary } from '../library/seed';
import type { LibraryStore, PublishedRevision } from '../library/service';
import type { LibraryData } from '../library/types';
import type { KV } from './kv';

const K = {
  draft: 'pr1.draft',
  revisions: 'pr1.revisions',
  working: 'pr1.working',
  inv: 'pr1.inv',
  events: 'pr1.events',
  user: 'pr1.user',
} as const;

export const LOCAL_HISTORY = 8;

export class LocalLibraryStore implements LibraryStore {
  constructor(private kv: KV) {
    if (!this.kv.get<PublishedRevision[] | null>(K.revisions, null)) {
      const seed = seedLibrary();
      const rev: PublishedRevision = {
        rev: 1,
        at: new Date().toISOString(),
        by: null,
        source: 'publish',
        data: seed,
      };
      this.kv.set(K.revisions, [rev]);
      this.kv.set(K.draft, seed);
    }
  }

  private revisions(): PublishedRevision[] {
    return this.kv.get<PublishedRevision[]>(K.revisions, []);
  }

  getDraft(): LibraryData {
    return this.kv.get<LibraryData | null>(K.draft, null) ?? deepClone(this.getPublished().data);
  }

  setDraft(data: LibraryData): void {
    this.kv.set(K.draft, data);
  }

  getPublished(): PublishedRevision {
    const revs = this.revisions();
    return revs[revs.length - 1]!;
  }

  appendPublished(revision: PublishedRevision): void {
    const revs = this.revisions();
    const head = revs[revs.length - 1];
    if (head && revision.rev !== head.rev + 1) {
      throw new Error(`Revision ${revision.rev} does not follow ${head.rev}`);
    }
    revs.push(revision);
    // this device keeps only the latest few revisions; the backend keeps 30 days
    while (revs.length > LOCAL_HISTORY) revs.shift();
    this.kv.set(K.revisions, revs);
  }

  history(): readonly PublishedRevision[] {
    return this.revisions();
  }
}

const DAY_MS = 24 * 60 * 60000;

export class LocalEventLog implements EventLog, EventSource {
  private events: PourEvent[];

  constructor(
    private kv: KV,
    private clock: () => Date = () => new Date(),
  ) {
    const all = this.kv.get<PourEvent[]>(K.events, []);
    const cutoff = this.clock().getTime() - 30 * DAY_MS;
    // Conner, 2026-10-27: uncommitted taps may be discarded after a month.
    this.events = all.filter((e) => e.committed || Date.parse(e.ts) >= cutoff);
    if (this.events.length !== all.length) this.kv.set(K.events, this.events);
  }

  append(type: string, ctx: EventContext, data: Record<string, unknown> = {}): PourEvent {
    return this.push(type, ctx, data, true);
  }

  tap(type: string, ctx: EventContext, data: Record<string, unknown> = {}): PourEvent {
    return this.push(type, ctx, data, false);
  }

  private push(type: string, ctx: EventContext, data: Record<string, unknown>, committed: boolean): PourEvent {
    const event: PourEvent = Object.freeze({
      ts: this.clock().toISOString(),
      type,
      user: ctx.user,
      tab: ctx.tab ?? null,
      committed,
      data: Object.freeze(structuredClone(data)),
    });
    this.events.push(event);
    this.kv.set(K.events, this.events);
    return event;
  }

  all(): readonly PourEvent[] {
    return this.events.slice();
  }

  ofType(type: string): readonly PourEvent[] {
    return this.events.filter((e) => e.type === type);
  }
}

/** Starting counts, outside the publish cycle (SPEC §6). */
export function loadInventory(kv: KV): Record<string, number> {
  const inv = kv.get<Record<string, number> | null>(K.inv, null);
  if (inv) return inv;
  const seeded = seedInventory();
  kv.set(K.inv, seeded);
  return seeded;
}

export function saveInventory(kv: KV, inv: Record<string, number>): void {
  kv.set(K.inv, inv);
}

/** The editor's working copy survives a reload (autosave; the draft is still explicit). */
export function loadWorking(kv: KV): LibraryData | null {
  return kv.get<LibraryData | null>(K.working, null);
}

export function saveWorking(kv: KV, data: LibraryData): void {
  kv.set(K.working, data);
}

export function loadUser(kv: KV): string {
  return kv.get<string>(K.user, '2222');
}

export function saveUser(kv: KV, pin: string): void {
  kv.set(K.user, pin);
}
