/**
 * The event log (SPEC §15). Every action writes an append-only event
 * `{ts, type, user, tab, ...data}`; reporting is built from it.
 *
 * The domain object keeps the extra fields in `data`; storage flattens or
 * nests as it likes, but nothing is ever updated or deleted.
 *
 * Production keeps everything — the prototype's 5,000-event cap was a
 * browser-storage shortcut (its own comment says so). If volume ever becomes
 * a problem, flag Conner rather than trimming (CLAUDE.md).
 */
export interface PourEvent {
  /** ISO timestamp */
  readonly ts: string;
  readonly type: string;
  /** staff PIN-identity acting, or null before sign-in */
  readonly user: string | null;
  /** the tab in scope, when there is one */
  readonly tab: string | null;
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
