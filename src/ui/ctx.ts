import { createContext, useContext } from 'react';
import type { PourEvent } from '../events/types';
import type { LibraryService, PubState } from '../library/service';
import type { LibraryData } from '../library/types';

/** The prototype's test staff (SPEC §3). Real sign-in lands in milestone 2. */
export const STAFF = [
  { pin: '1111', name: 'Alex', role: 'Staff' },
  { pin: '2222', name: 'Morgan', role: 'Manager' },
  { pin: '3333', name: 'Jordan', role: 'Staff' },
  { pin: '4444', name: 'Riley', role: 'Staff' },
  { pin: '5555', name: 'Casey', role: 'Staff' },
] as const;

export const staffName = (pin: string | null): string =>
  STAFF.find((s) => s.pin === pin)?.name ?? 'Unassigned';

export interface AppCtx {
  working: LibraryData;
  /** apply an edit to the working copy (autosaved on this device) */
  mutate: (fn: (d: LibraryData) => void) => void;
  service: LibraryService;
  pub: PubState;
  /** published-revision count bump, so history views refresh */
  historyVersion: number;
  user: string;
  setUser: (pin: string) => void;
  inv: Record<string, number>;
  setCount: (pid: string, count: number) => void;
  saveDraft: () => void;
  publish: () => void;
  discardEdits: () => void;
  revertToPublished: () => void;
  restoreRevision: (rev: number) => void;
  events: () => readonly PourEvent[];
}

export const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp outside provider');
  return ctx;
}
