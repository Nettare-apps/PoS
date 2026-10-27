/**
 * The event log (SPEC §15). Every action writes an append-only event
 * `{ts, type, user, tab, ...data}`; reporting is built from it.
 *
 * The domain object keeps the extra fields in `data`; storage flattens or
 * nests as it likes, but nothing is ever updated or deleted.
 *
 * Logging bar (Conner, 2026-10-27): EVERY button press is logged for now.
 * Committed actions (the SPEC §15 event types — rings, sends, removals,
 * publishes…) are kept forever; raw UI taps that commit nothing (keypad
 * digits, navigation, category chips) carry committed:false and may be
 * discarded after a month to avoid pile-up during testing. Recording may be
 * relaxed if we ever go live and volume climbs — flag Conner first, never
 * trim quietly (CLAUDE.md). The prototype's 5,000-event cap was only a
 * browser-storage shortcut.
 */
export interface PourEvent {
  /** ISO timestamp */
  readonly ts: string;
  readonly type: string;
  /** staff PIN-identity acting, or null before sign-in */
  readonly user: string | null;
  /** the tab in scope, when there is one */
  readonly tab: string | null;
  /** false for raw UI taps, which may be discarded after ~30 days */
  readonly committed: boolean;
  readonly data: Readonly<Record<string, unknown>>;
}

/** Library event types in scope for milestone 1 (SPEC §15 "Library"). */
export type LibraryEventType =
  | 'library_save_draft'
  | 'library_publish'
  | 'library_revert'
  | 'library_discard';

export interface EventContext {
  user: string | null;
  tab?: string | null;
}
