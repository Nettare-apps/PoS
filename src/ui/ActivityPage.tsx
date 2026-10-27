/**
 * The activity view over the append-only event log (SPEC §15). Everything is
 * recorded; quick-edit publishes are easy to find (Conner, 2026-10-27).
 */
import { useMemo, useState } from 'react';
import { staffName, useApp } from './ctx';

export function ActivityPage() {
  const app = useApp();
  const [committedOnly, setCommittedOnly] = useState(true);
  const [type, setType] = useState('All');
  void app.historyVersion;
  const events = app.events();

  const types = useMemo(() => ['All', ...new Set(events.map((e) => e.type))], [events]);
  const shown = events
    .filter((e) => (!committedOnly || e.committed) && (type === 'All' || e.type === type))
    .slice()
    .reverse()
    .slice(0, 300);

  return (
    <div className="activity pane">
      <div className="libtools">
        <label className="chk">
          <input type="checkbox" checked={committedOnly} onChange={(e) => setCommittedOnly(e.target.checked)} />
          Committed actions only
        </label>
        <label className="f inline">
          <span className="lbl">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <span className="muted">
          {events.length} events on this device · taps older than 30 days are discarded (committed actions are
          kept)
        </span>
      </div>
      <ul className="evlist">
        {shown.map((e, i) => (
          <li key={`${e.ts}-${i}`} className={e.committed ? '' : 'tap'}>
            <span className="num ets">{new Date(e.ts).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}</span>
            <span className="etype">
              {e.type}
              {e.type === 'library_publish' && e.data['source'] === 'quick_edit' ? <span className="badge qe">quick edit</span> : null}
              {!e.committed ? <span className="badge tapb">tap</span> : null}
            </span>
            <span className="muted">{staffName(e.user)}</span>
            <span className="edata muted">{summarize(e.data)}</span>
          </li>
        ))}
        {!shown.length ? <li className="muted empty">Nothing yet.</li> : null}
      </ul>
    </div>
  );
}

function summarize(data: Readonly<Record<string, unknown>>): string {
  const entries = Object.entries(data).filter(([, v]) => v != null);
  if (!entries.length) return '';
  return entries
    .slice(0, 5)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v).slice(0, 60) : String(v).slice(0, 60)}`)
    .join(' · ');
}
