import { deepClone } from './normalize';
import type { LibraryStore, PublishedRevision } from './service';
import type { LibraryData } from './types';

/** In-memory adapter for tests and local tools. */
export class MemoryLibraryStore implements LibraryStore {
  private draft: LibraryData;
  private revisions: PublishedRevision[];

  /** Seeds revision 1 as published, with the draft equal to it. */
  constructor(initial: LibraryData, at = new Date(0).toISOString()) {
    this.revisions = [{ rev: 1, at, by: null, data: deepClone(initial) }];
    this.draft = deepClone(initial);
  }

  getDraft(): LibraryData {
    return deepClone(this.draft);
  }

  setDraft(data: LibraryData): void {
    this.draft = deepClone(data);
  }

  getPublished(): PublishedRevision {
    const last = this.revisions[this.revisions.length - 1]!;
    return { ...last, data: deepClone(last.data) };
  }

  appendPublished(revision: PublishedRevision): void {
    const head = this.revisions[this.revisions.length - 1]!;
    if (revision.rev !== head.rev + 1) {
      throw new Error(`Revision ${revision.rev} does not follow ${head.rev}`);
    }
    this.revisions.push({ ...revision, data: deepClone(revision.data) });
  }

  history(): readonly PublishedRevision[] {
    return this.revisions.map((r) => ({ ...r, data: deepClone(r.data) }));
  }
}
