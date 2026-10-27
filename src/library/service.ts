/**
 * The library's draft → publish → revert lifecycle (SPEC §1/§7).
 *
 * Invariants:
 * - The register reads ONLY the published library (`published()`).
 * - Edits are drafts until published.
 * - Every publish is kept as a numbered revision, so a publish can be
 *   reverted to any earlier revision (Q3 default: keep history — a revert
 *   publishes the old revision's data as a NEW revision; history is never
 *   rewritten).
 * - "Discard edits" (working copy ← draft) is a client-side concern; the
 *   domain holds the draft and the published revisions.
 */
import type { EventLog } from '../events/log';
import type { EventContext } from '../events/types';
import { deepClone, deepEqual, normalizeLibrary } from './normalize';
import type { LibraryData } from './types';

export interface PublishedRevision {
  rev: number;
  at: string;
  by: string | null;
  data: LibraryData;
}

/** Storage port. Implementations must persist exactly what they are given. */
export interface LibraryStore {
  getDraft(): LibraryData;
  setDraft(data: LibraryData): void;
  getPublished(): PublishedRevision;
  appendPublished(revision: PublishedRevision): void;
  history(): readonly PublishedRevision[];
}

/** The prototype's publish-bar state (pubState, lines 1801-1804). */
export interface PubState {
  /** working copy differs from the saved draft */
  dirty: boolean;
  /** saved draft differs from published */
  unpub: boolean;
  /** working copy differs from published */
  diffLive: boolean;
}

export class LibraryService {
  constructor(
    private store: LibraryStore,
    private log: EventLog,
    private clock: () => Date = () => new Date(),
  ) {}

  /** What the register prices and sells from. Nothing else. */
  published(): LibraryData {
    return deepClone(this.store.getPublished().data);
  }

  publishedRevision(): PublishedRevision {
    const r = this.store.getPublished();
    return { ...r, data: deepClone(r.data) };
  }

  draft(): LibraryData {
    return deepClone(this.store.getDraft());
  }

  history(): readonly PublishedRevision[] {
    return this.store.history().map((r) => ({ ...r, data: deepClone(r.data) }));
  }

  pubState(working?: LibraryData): PubState {
    const w = working ?? this.store.getDraft();
    const draft = this.store.getDraft();
    const published = this.store.getPublished().data;
    return {
      dirty: !deepEqual(w, draft),
      unpub: !deepEqual(draft, published),
      diffLive: !deepEqual(w, published),
    };
  }

  /** Save the working copy as the draft (prototype pb-save, line 1837). */
  saveDraft(data: LibraryData, ctx: EventContext): void {
    this.store.setDraft(normalizeLibrary(deepClone(data)));
    this.log.append('library_save_draft', ctx);
  }

  /**
   * Publish the working copy: it becomes both the draft and the published
   * library, as a new revision (prototype pb-pub, lines 1838-1843).
   */
  publish(data: LibraryData, ctx: EventContext): PublishedRevision {
    const normalized = normalizeLibrary(deepClone(data));
    const rev = this.store.getPublished().rev + 1;
    const revision: PublishedRevision = {
      rev,
      at: this.clock().toISOString(),
      by: ctx.user,
      data: normalized,
    };
    this.store.setDraft(deepClone(normalized));
    this.store.appendPublished(revision);
    this.log.append('library_publish', ctx, { rev });
    return revision;
  }

  /**
   * Drop every change since the last publish, including the saved draft
   * (prototype revert, line 1830). Returns the restored data.
   */
  revertToPublished(ctx: EventContext): LibraryData {
    const published = this.store.getPublished();
    this.store.setDraft(deepClone(published.data));
    this.log.append('library_revert', ctx, { toRev: published.rev });
    return deepClone(published.data);
  }

  /**
   * Roll the published library back to an earlier revision by publishing that
   * revision's data as a NEW revision. History is append-only.
   */
  revertToRevision(rev: number, ctx: EventContext): PublishedRevision {
    const target = this.store.history().find((r) => r.rev === rev);
    if (!target) throw new Error(`No published revision ${rev}`);
    const republished = this.publish(deepClone(target.data), ctx);
    this.log.append('library_revert', ctx, { toRev: rev, publishedAs: republished.rev });
    return republished;
  }
}
