/**
 * The pour editor (SPEC §7 Products): name, costs, size and pack, the
 * custom-pour basis and scale, servings, count — plus modifier setup and the
 * happy hour setting.
 */
import { useState } from 'react';
import { formatCents } from '../engine/money';
import { customQuote, lowPerMl, servingMl } from '../engine/pricing';
import { COST_BASES, type CostBasis, type Pour } from '../engine/types';
import { CategoryPicker } from './CategoryPicker';
import { useApp } from './ctx';
import { HHOverride } from './HHOverride';
import { MoneyField, NumField, TextField } from './inputs';
import { ModsSetup } from './ModsSetup';
import { ServingsTable } from './ServingsTable';

export function ProductForm(props: { pour: Pour; onDeleted: () => void }) {
  const app = useApp();
  const p = props.pour;
  const [confirmDel, setConfirmDel] = useState(false);
  const edit = (fn: (dp: Pour) => void) =>
    app.mutate((d) => {
      const dp = d.products.find((x) => x.id === p.id);
      if (dp && dp.kind === 'pour') fn(dp);
    });

  const count = app.inv[p.id] ?? 0;
  const low = lowPerMl(p);
  const sample = customQuote(p, 1.5, 'oz');

  return (
    <div className="pform">
      <div className="fhead">
        <TextField label="Name" value={p.name} onCommit={(v) => v.trim() && edit((dp) => (dp.name = v.trim()))} />
        <TextField label="Section" value={p.section ?? ''} onCommit={(v) => edit((dp) => (dp.section = v || undefined))} />
      </div>

      <section className="fs">
        <h3>Container and costs</h3>
        <div className="row4">
          <NumField label="Size (mL)" value={p.size} min={1} onCommit={(v) => v != null && v > 0 && edit((dp) => (dp.size = v))} />
          <NumField label="Pack" value={p.pack} min={1} onCommit={(v) => v != null && v > 0 && edit((dp) => (dp.pack = v))} />
          {COST_BASES.map((b) => (
            <MoneyField key={b} label={`${b[0]!.toUpperCase()}${b.slice(1)} $`} cents={p.cost[b]} onCommit={(v) => edit((dp) => (dp.cost[b] = v))} />
          ))}
        </div>
        <p className="muted hint">
          Theoretical cost always uses the lowest cost on file{low != null ? ` — ${formatCents(Math.round(low * 100 * p.size))} per container here` : ''}.
        </p>
      </section>

      <section className="fs">
        <h3>Custom pour sliding scale</h3>
        <div className="row4">
          <label className="f">
            <span className="lbl">Custom pours price from</span>
            <select value={p.basis} onChange={(e) => edit((dp) => (dp.basis = e.target.value as CostBasis))}>
              {COST_BASES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          <NumField label="Cost % · bucket 1" value={p.scale.min} min={1} onCommit={(v) => v != null && v > 0 && edit((dp) => (dp.scale.min = v))} />
          <NumField label="Cost % · bucket 10" value={p.scale.max} min={1} onCommit={(v) => v != null && v > 0 && edit((dp) => (dp.scale.max = v))} />
        </div>
        <p className="muted hint">
          New standard pours start on this cost basis; each pour button picks its own below. A 1.5 oz custom
          pour currently rings at {sample.price != null ? formatCents(sample.price) : '—'} (bucket {sample.b},{' '}
          {sample.pct.toFixed(1)}% target).
        </p>
      </section>

      <ServingsTable pour={p} />
      <CategoryPicker product={p} />
      <ModsSetup productId={p.id} cats={p.cats} productName={p.name} />
      <HHOverride product={p} />

      <section className="fs">
        <h3>On hand</h3>
        <div className="row2">
          <NumField
            label="Bottles"
            value={count}
            min={0}
            step={0.1}
            // counts apply immediately, so an emptied field never silently zeroes the live count
            onCommit={(v) => v != null && v >= 0 && app.setCount(p.id, v)}
          />
          <p className="muted hint">
            Counts apply immediately — they are not part of the publish cycle. From this count:{' '}
            {p.servings.map((s) => `${s.label ?? `${s.qty} ${s.unit}`} × ${Math.max(0, Math.floor((count * p.size) / servingMl(s) + 1e-9))}`).join(' · ') || 'no pours set'}
            .
          </p>
        </div>
      </section>

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
              Delete product
            </button>
          </>
        ) : (
          <button className="btn sm" onClick={() => setConfirmDel(true)}>
            Delete this product…
          </button>
        )}
      </section>
    </div>
  );
}
