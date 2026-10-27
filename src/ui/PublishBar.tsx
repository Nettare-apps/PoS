/**
 * The publish bar (SPEC §7): Discard edits · Revert to published · Save
 * draft · Publish, with the prototype's two-step confirms (lines 1812-1844),
 * plus the revision history (every publish kept, quick edits marked —
 * Conner, 2026-10-27).
 */
import { useState } from 'react';
import { staffName, useApp } from './ctx';

export function PublishBar() {
  const app = useApp();
  const [confirm, setConfirm] = useState<null | 'discard' | 'revert' | number>(null);
  const [showHistory, setShowHistory] = useState(false);
  const { pub } = app;

  const tone = pub.dirty ? 'dirty' : pub.unpub ? 'draft' : 'clean';
  const status = pub.dirty
    ? pub.unpub
      ? 'Unsaved edits · saved draft not yet published'
      : 'Unsaved edits'
    : pub.unpub
      ? 'Draft saved · not yet published'
      : 'Published · no pending changes';

  const ask =
    confirm === 'discard'
      ? 'Discard edits since your last save?'
      : confirm === 'revert'
        ? 'Drop every change since the last publish, including the saved draft?'
        : typeof confirm === 'number'
          ? `Publish revision ${confirm} again as the current library?`
          : null;

  const yes = () => {
    if (confirm === 'discard') app.discardEdits();
    else if (confirm === 'revert') app.revertToPublished();
    else if (typeof confirm === 'number') app.restoreRevision(confirm);
    setConfirm(null);
  };

  return (
    <div className="pubbar">
      <div className={`pstat ${tone}`}>
        <span className="dot" aria-hidden="true" />
        <span>{status}</span>
      </div>
      <div className="pacts">
        {ask ? (
          <>
            <span className="warnbox" role="alert">
              {ask}
            </span>
            <button className="btn" onClick={() => setConfirm(null)}>
              Keep editing
            </button>
            <button className="btn danger" onClick={yes}>
              {confirm === 'discard' ? 'Discard' : confirm === 'revert' ? 'Revert' : 'Restore'}
            </button>
          </>
        ) : (
          <>
            <button className="btn" disabled={!pub.dirty} onClick={() => setConfirm('discard')}>
              Discard edits
            </button>
            <button className="btn" disabled={!pub.diffLive} onClick={() => setConfirm('revert')}>
              Revert to published
            </button>
            <button className="btn" disabled={!pub.dirty} onClick={app.saveDraft}>
              Save draft
            </button>
            <button className="btn pub" disabled={!pub.diffLive} onClick={app.publish}>
              Publish
            </button>
            <button className="btn" aria-expanded={showHistory} onClick={() => setShowHistory((s) => !s)}>
              History
            </button>
          </>
        )}
      </div>
      {showHistory && !ask ? <HistoryPanel onRestore={(rev) => setConfirm(rev)} /> : null}
    </div>
  );
}

function HistoryPanel(props: { onRestore: (rev: number) => void }) {
  const app = useApp();
  void app.historyVersion;
  const revs = app.service.history().slice().reverse();
  const current = revs[0]?.rev;
  return (
    <div className="history">
      <p className="muted hnote">
        Every publish is a kept revision; quick edits are marked. This device keeps the last{' '}
        {revs.length >= 8 ? 8 : revs.length} — the real backend keeps 30 days.
      </p>
      <ul>
        {revs.map((r) => (
          <li key={r.rev}>
            <span className="num">#{r.rev}</span>
            <span>{new Date(r.at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
            <span className="muted">{staffName(r.by)}</span>
            {r.source === 'quick_edit' ? <span className="badge qe">quick edit</span> : null}
            {r.source === 'revert' ? <span className="badge rv">revert</span> : null}
            {r.rev === current ? (
              <span className="badge cur">current</span>
            ) : (
              <button className="btn sm" onClick={() => props.onRestore(r.rev)}>
                Restore
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
