/**
 * The menu-item editor (SPEC §7 Menu items): whole-dollar price, allergens,
 * the linked recipe with its cost, modifiers and happy hour. Recipes come
 * from the Recipe Book snapshot and are read-only here.
 */
import { useState } from 'react';
import { formatCents } from '../engine/money';
import { itemCost, lowPerMl } from '../engine/pricing';
import { isPour, type MenuItem } from '../engine/types';
import { CategoryPicker } from './CategoryPicker';
import { useApp } from './ctx';
import { HHOverride } from './HHOverride';
import { NumField, TextField } from './inputs';
import { ModsSetup } from './ModsSetup';

export function ItemForm(props: { item: MenuItem; onDeleted: () => void }) {
  const app = useApp();
  const p = props.item;
  const [confirmDel, setConfirmDel] = useState(false);
  const edit = (fn: (dp: MenuItem) => void) =>
    app.mutate((d) => {
      const dp = d.products.find((x) => x.id === p.id);
      if (dp && dp.kind === 'item') fn(dp);
    });

  const lookup = (pid: string) => app.working.products.find((x) => x.id === pid);
  const cost = itemCost(p, lookup);

  return (
    <div className="pform">
      <div className="fhead">
        <TextField label="Name" value={p.name} onCommit={(v) => v.trim() && edit((dp) => (dp.name = v.trim()))} />
        <TextField label="Section" value={p.section ?? ''} onCommit={(v) => edit((dp) => (dp.section = v || undefined))} />
      </div>

      <section className="fs">
        <h3>Price</h3>
        <div className="row4">
          <NumField
            label="Price $ (whole dollars)"
            value={p.price / 100}
            min={0}
            step={1}
            onCommit={(v) =>
              edit((dp) => {
                dp.price = Math.round(Math.max(0, v ?? 0)) * 100;
                // entering a real price reconciles it: the placeholder flag clears (prototype parity)
                if (dp.price > 0) delete dp.placeholder;
              })
            }
          />
          <label className="chk">
            <input type="checkbox" checked={!!p.placeholder} onChange={(e) => edit((dp) => (dp.placeholder = e.target.checked || undefined))} />
            Placeholder price (reconcile at go-live)
          </label>
          <TextField label="Station" value={p.station ?? ''} onCommit={(v) => edit((dp) => (dp.station = v || undefined))} />
        </div>
        <p className="muted hint">Base menu prices stay whole dollars (SPEC §5); percentages and check math are exact to the cent.</p>
      </section>

      <section className="fs">
        <h3>Allergens</h3>
        <TextField
          label="Comma-separated"
          value={(p.allergens ?? []).join(', ')}
          onCommit={(v) => edit((dp) => (dp.allergens = v.split(',').map((s) => s.trim()).filter(Boolean)))}
          placeholder="e.g. Dairy, Gluten, Tree nuts"
        />
      </section>

      <section className="fs">
        <h3>Recipe (depletion)</h3>
        {p.recipe.length ? (
          <div className="scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Depletes</th>
                <th className="num">mL</th>
                <th className="num">Cost</th>
              </tr>
            </thead>
            <tbody>
              {p.recipe.map((r, i) => {
                const q = lookup(r.pid);
                const pm = q && isPour(q) ? lowPerMl(q) : null;
                return (
                  <tr key={i}>
                    <td>{q?.name ?? r.pid}</td>
                    <td className="num">{r.ml}</td>
                    <td className="num">{pm != null ? formatCents(Math.round(pm * r.ml * 100)) : '—'}</td>
                  </tr>
                );
              })}
              <tr>
                <td colSpan={2}>
                  <b>Recipe cost (lowest cost on file)</b>
                </td>
                <td className="num">
                  <b>{formatCents(cost)}</b>
                </td>
              </tr>
            </tbody>
          </table>
          </div>
        ) : (
          <p className="muted hint">No linked recipe. Recipes come from the Recipe Book; matching happens at import.</p>
        )}
      </section>

      <CategoryPicker product={p} />
      <ModsSetup productId={p.id} cats={p.cats} productName={p.name} />
      <HHOverride product={p} />

      <section className="fs danger-zone">
        {confirmDel ? (
          <>
            <span className="warnbox">Delete {p.name} from the library? It stays in past revisions and the log.</span>
            <button className="btn sm" onClick={() => setConfirmDel(false)}>
              Keep it
            </button>
            <button
              className="btn sm danger"
              onClick={() => {
                app.mutate((d) => {
                  d.products = d.products.filter((x) => x.id !== p.id);
                  delete d.mods.items[p.id];
                });
                props.onDeleted();
              }}
            >
              Delete item
            </button>
          </>
        ) : (
          <button className="btn sm" onClick={() => setConfirmDel(true)}>
            Delete this item…
          </button>
        )}
      </section>
    </div>
  );
}
