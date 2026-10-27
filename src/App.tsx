/**
 * Milestone 1 app: the Library (products, modifiers, happy hour) with the
 * publish lifecycle, and the activity log. The register and floor come in
 * milestone 2; sign-in is a stand-in selector until then.
 *
 * Storage is ON THIS DEVICE (localStorage) as a stand-in until the backend
 * decision lands — same draft/publish semantics, swapped by adapter later.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { LibraryService } from './library/service';
import type { LibraryData } from './library/types';
import { LocalStorageKV } from './storage/kv';
import {
  LocalEventLog,
  LocalLibraryStore,
  loadInventory,
  loadUser,
  loadWorking,
  saveInventory,
  saveUser,
  saveWorking,
} from './storage/local';
import { ActivityPage } from './ui/ActivityPage';
import { Ctx, STAFF, type AppCtx } from './ui/ctx';
import { HHTab } from './ui/HHTab';
import { ModsTab } from './ui/ModsTab';
import { ProductsTab } from './ui/ProductsTab';
import { PublishBar } from './ui/PublishBar';

type View = 'library' | 'activity';
type LibTab = 'products' | 'mods' | 'hh';

export function App() {
  const [storageError, setStorageError] = useState('');
  const kv = useMemo(() => new LocalStorageKV(setStorageError), []);
  const { service, log } = useMemo(() => {
    const store = new LocalLibraryStore(kv);
    const eventLog = new LocalEventLog(kv);
    return { service: new LibraryService(store, eventLog), log: eventLog };
  }, [kv]);

  const [working, setWorkingState] = useState<LibraryData>(() => loadWorking(kv) ?? service.draft());
  const [user, setUserState] = useState(() => loadUser(kv));
  const [inv, setInv] = useState<Record<string, number>>(() => loadInventory(kv));
  const [version, setVersion] = useState(0);
  const [view, setView] = useState<View>('library');
  const [tab, setTab] = useState<LibTab>('products');

  const workingRef = useRef(working);
  const setWorking = (d: LibraryData) => {
    workingRef.current = d;
    setWorkingState(d);
    saveWorking(kv, d);
  };

  const pub = useMemo(() => service.pubState(working), [service, working, version]);

  const ctxValue: AppCtx = {
    working,
    mutate: useCallback((fn) => {
      const next = structuredClone(workingRef.current);
      fn(next);
      setWorking(next);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
    service,
    pub,
    historyVersion: version,
    user,
    setUser: (pin) => {
      setUserState(pin);
      saveUser(kv, pin);
    },
    inv,
    setCount: (pid, count) => {
      const from = inv[pid] ?? 0;
      const next = { ...inv, [pid]: count };
      setInv(next);
      saveInventory(kv, next);
      log.append('count_set', { user }, { pid, from, to: count });
      setVersion((v) => v + 1);
    },
    saveDraft: () => {
      service.saveDraft(workingRef.current, { user });
      setWorking(service.draft());
      setVersion((v) => v + 1);
    },
    publish: () => {
      service.publish(workingRef.current, { user });
      setWorking(service.draft());
      setVersion((v) => v + 1);
    },
    discardEdits: () => {
      setWorking(service.draft());
      setVersion((v) => v + 1);
    },
    revertToPublished: () => {
      setWorking(service.revertToPublished({ user }));
      setVersion((v) => v + 1);
    },
    restoreRevision: (rev) => {
      service.revertToRevision(rev, { user });
      setWorking(service.draft());
      setVersion((v) => v + 1);
    },
    events: () => log.all(),
  };

  // Log every button press (Conner, 2026-10-27) as an uncommitted tap.
  const onTap = (e: React.MouseEvent) => {
    const btn = (e.target as HTMLElement).closest('button');
    if (!btn) return;
    const label = (btn.getAttribute('aria-label') || btn.textContent || '').trim().slice(0, 40);
    log.tap('tap', { user }, { label, view, tab });
  };

  return (
    <Ctx.Provider value={ctxValue}>
      <div className="appwrap" onClickCapture={onTap}>
        <header className="mast">
          <h1>Pour Register</h1>
          <nav className="seg" aria-label="Sections">
            <button aria-pressed={view === 'library'} onClick={() => setView('library')}>
              Library
            </button>
            <button aria-pressed={view === 'activity'} onClick={() => setView('activity')}>
              Activity
            </button>
          </nav>
          <label className="f inline who">
            <span className="lbl">Acting as</span>
            <select value={user} onChange={(e) => ctxValue.setUser(e.target.value)} aria-label="Acting as">
              {STAFF.map((s) => (
                <option key={s.pin} value={s.pin}>
                  {s.name} ({s.role})
                </option>
              ))}
            </select>
          </label>
        </header>
        <p className="muted standin">
          Milestone 1 build — library and event log only. Data lives on this device until the backend lands;
          sign-in comes with the register in milestone 2.
        </p>
        {storageError ? (
          <p className="note err" role="alert">
            {storageError}
          </p>
        ) : null}
        {view === 'library' ? (
          <main>
            <PublishBar />
            <nav className="seg libtabs" aria-label="Library section">
              <button aria-pressed={tab === 'products'} onClick={() => setTab('products')}>
                Products
              </button>
              <button aria-pressed={tab === 'mods'} onClick={() => setTab('mods')}>
                Modifiers
              </button>
              <button aria-pressed={tab === 'hh'} onClick={() => setTab('hh')}>
                Happy hour
              </button>
            </nav>
            {tab === 'products' ? <ProductsTab /> : tab === 'mods' ? <ModsTab /> : <HHTab />}
          </main>
        ) : (
          <main>
            <ActivityPage />
          </main>
        )}
      </div>
    </Ctx.Provider>
  );
}
