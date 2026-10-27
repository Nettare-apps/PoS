import type { EventContext, PourEvent } from './types';

/** Append-only writer. There is deliberately no update or delete. */
export interface EventLog {
  append(type: string, ctx: EventContext, data?: Record<string, unknown>): PourEvent;
}

/** Read side, for reporting and tests. */
export interface EventSource {
  all(): readonly PourEvent[];
  ofType(type: string): readonly PourEvent[];
}

/** In-memory adapter for tests and local tools. Events are frozen on append. */
export class MemoryEventLog implements EventLog, EventSource {
  private events: PourEvent[] = [];

  constructor(private clock: () => Date = () => new Date()) {}

  append(type: string, ctx: EventContext, data: Record<string, unknown> = {}): PourEvent {
    const event: PourEvent = Object.freeze({
      ts: this.clock().toISOString(),
      type,
      user: ctx.user,
      tab: ctx.tab ?? null,
      data: Object.freeze({ ...data }),
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
