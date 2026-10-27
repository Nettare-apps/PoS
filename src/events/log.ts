import type { EventContext, PourEvent } from './types';

/**
 * Append-only writer. There is deliberately no update or delete.
 * `tap` records a raw UI press (committed:false — kept ~30 days during
 * testing); `append` records a committed action (kept forever).
 */
export interface EventLog {
  append(type: string, ctx: EventContext, data?: Record<string, unknown>): PourEvent;
  tap(type: string, ctx: EventContext, data?: Record<string, unknown>): PourEvent;
}

/** Read side, for reporting and tests. */
export interface EventSource {
  all(): readonly PourEvent[];
  ofType(type: string): readonly PourEvent[];
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

/**
 * In-memory adapter for tests and local tools. Appended events are detached
 * from the caller's objects (deep clone) and deep-frozen, so a logged event
 * can never be rewritten — not even through a nested object.
 */
export class MemoryEventLog implements EventLog, EventSource {
  private events: PourEvent[] = [];

  constructor(private clock: () => Date = () => new Date()) {}

  append(type: string, ctx: EventContext, data: Record<string, unknown> = {}): PourEvent {
    return this.push(type, ctx, data, true);
  }

  tap(type: string, ctx: EventContext, data: Record<string, unknown> = {}): PourEvent {
    return this.push(type, ctx, data, false);
  }

  private push(type: string, ctx: EventContext, data: Record<string, unknown>, committed: boolean): PourEvent {
    const event: PourEvent = deepFreeze({
      ts: this.clock().toISOString(),
      type,
      user: ctx.user,
      tab: ctx.tab ?? null,
      committed,
      data: structuredClone(data),
    });
    this.events.push(event);
    return event;
  }

  all(): readonly PourEvent[] {
    return this.events.slice();
  }

  ofType(type: string): readonly PourEvent[] {
    return this.events.filter((e) => e.type === type);
  }
}
