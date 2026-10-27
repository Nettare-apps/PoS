/** Rename, delete, add and re-parent categories (SPEC §7 Categories). */
import { useState } from 'react';
import {
  addCategory,
  childrenOf,
  deleteCategory,
  orderedCategories,
  renameCategory,
  setParent,
} from '../library/categories';
import { useApp } from './ctx';
import { TextField } from './inputs';

export function CategoriesManager() {
  const app = useApp();
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const { categories, settings } = app.working;
  const ordered = orderedCategories(categories, settings.parents);
  const parents = categories.filter((c) => childrenOf(settings.parents, c).length || !settings.parents[c]);

  return (
    <div className="catmgr">
      <p className="muted hint">
        Renaming updates every product's tags, parents and menu assignments. Deleting removes the tag;
        products keep their other categories.
      </p>
      {error ? <p className="note err" role="alert">{error}</p> : null}
      <div className="scroll">
      <table className="tbl">
        <thead>
          <tr>
            <th>Category</th>
            <th>Parent</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((c) => (
            <tr key={c}>
              <td>
                <TextField
                  label=""
                  value={c}
                  onCommit={(v) => {
                    let err = '';
                    app.mutate((d) => {
                      err = renameCategory(d, c, v);
                    });
                    setError(err);
                  }}
                />
              </td>
              <td>
                <select
                  value={settings.parents[c] ?? ''}
                  aria-label={`Parent of ${c}`}
                  onChange={(e) => app.mutate((d) => setParent(d, c, e.target.value || null))}
                >
                  <option value="">—</option>
                  {parents
                    .filter((pc) => pc !== c)
                    .map((pc) => (
                      <option key={pc} value={pc}>
                        {pc}
                      </option>
                    ))}
                </select>
              </td>
              <td>
                {confirmDel === c ? (
                  <>
                    <button className="btn sm danger" onClick={() => { app.mutate((d) => deleteCategory(d, c)); setConfirmDel(null); }}>
                      Delete {c}
                    </button>
                    <button className="btn sm" onClick={() => setConfirmDel(null)}>
                      Keep
                    </button>
                  </>
                ) : (
                  <button className="btn sm" onClick={() => setConfirmDel(c)}>
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <div className="row2">
        <label className="f">
          <span className="lbl">New category</span>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Zero Proof" />
        </label>
        <button
          className="btn"
          onClick={() => {
            let err = '';
            app.mutate((d) => {
              err = addCategory(d, newName);
            });
            setError(err);
            if (!err) setNewName('');
          }}
        >
          Add category
        </button>
      </div>
    </div>
  );
}
