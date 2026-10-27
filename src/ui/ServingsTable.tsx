/**
 * The serving buttons of a pour (SPEC §7 Products): label, amount, unit,
 * basis, target %, override — with the engine's derived price and actual
 * cost % beside each row.
 */
import { formatCents } from '../engine/money';
import { servingMl, stdQuote } from '../engine/pricing';
import { COST_BASES, type Pour, type Serving } from '../engine/types';
import { useApp } from './ctx';
import { MoneyField, NumField, TextField } from './inputs';

export function ServingsTable(props: { pour: Pour }) {
  const app = useApp();
  const p = props.pour;
  const edit = (i: number, fn: (s: Serving) => void) =>
    app.mutate((d) => {
      const dp = d.products.find((x) => x.id === p.id);
      if (dp && dp.kind === 'pour' && dp.servings[i]) fn(dp.servings[i]!);
    });

  return (
    <section className="fs">
      <h3>Standard pours</h3>
      <div className="scroll">
        <table className="tbl servings">
          <thead>
            <tr>
              <th>Button label</th>
              <th>Amount</th>
              <th>Unit</th>
              <th>Price from</th>
              <th className="num">Target %</th>
              <th className="num">Override $</th>
              <th className="num">Price</th>
              <th className="num">Actual %</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {p.servings.map((s, i) => {
              const q = stdQuote(p, s);
              return (
                <tr key={i}>
                  <td>
                    <TextField label="" value={s.label ?? ''} onCommit={(v) => edit(i, (sv) => (sv.label = v || undefined))} placeholder={`${s.qty} ${s.unit}`} />
                  </td>
                  <td>
                    <NumField label="" value={s.qty} min={0} step={0.25} width={64} onCommit={(v) => v != null && v > 0 && edit(i, (sv) => (sv.qty = v))} />
                  </td>
                  <td>
                    <select value={s.unit} onChange={(e) => edit(i, (sv) => (sv.unit = e.target.value as Serving['unit']))} aria-label="Unit">
                      <option value="oz">oz</option>
                      <option value="ml">mL</option>
                    </select>
                  </td>
                  <td>
                    <select value={s.basis} onChange={(e) => edit(i, (sv) => (sv.basis = e.target.value as Serving['basis']))} aria-label="Price from">
                      {COST_BASES.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="num">
                    <NumField label="" value={s.target} min={0} step={1} width={56} onCommit={(v) => v != null && v > 0 && edit(i, (sv) => (sv.target = v))} />
                  </td>
                  <td className="num">
                    {/* overrides are whole dollars (SPEC §5), rounded on commit like the item price */}
                    <MoneyField
                      label=""
                      cents={s.override ?? null}
                      step={1}
                      width={64}
                      onCommit={(v) =>
                        edit(i, (sv) => {
                          const whole = v != null && v > 0 ? Math.round(v / 100) * 100 : 0;
                          if (whole > 0) sv.override = whole;
                          else delete sv.override;
                        })
                      }
                    />
                  </td>
                  <td className="num">
                    {q.price != null ? formatCents(q.price) : '—'}
                    {q.over ? <span className="badge qe">override</span> : null}
                  </td>
                  <td className="num">{q.actual != null ? `${q.actual.toFixed(1)}%` : '—'}</td>
                  <td>
                    <button className="btn sm" aria-label={`Remove ${s.label ?? `${s.qty} ${s.unit}`}`} onClick={() => app.mutate((d) => {
                      const dp = d.products.find((x) => x.id === p.id);
                      if (dp && dp.kind === 'pour') dp.servings.splice(i, 1);
                    })}>
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button
        className="btn sm"
        onClick={() =>
          app.mutate((d) => {
            const dp = d.products.find((x) => x.id === p.id);
            // new standard pours start on the product's custom-pour cost basis (prototype note, line 1968)
            if (dp && dp.kind === 'pour') dp.servings.push({ qty: 1, unit: 'oz', target: dp.scale.min || 15, basis: dp.basis });
          })
        }
      >
        + Add a pour
      </button>
      <p className="muted hint">
        {p.servings.length
          ? `Volumes: ${p.servings.map((s) => `${s.label ?? `${s.qty} ${s.unit}`} = ${Math.round(servingMl(s))} mL`).join(' · ')}`
          : 'No serving buttons yet.'}
      </p>
    </section>
  );
}
