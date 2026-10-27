/**
 * Library > Happy hour (SPEC §14): the weekly schedule and the per-menu
 * pricing rules. Publishes like everything else; windows may cross midnight
 * (Conner, 2026-10-27). Items override these on their own pages.
 */
import type { HHSetting } from '../engine/types';
import { orderedCategories } from '../library/categories';
import { useApp } from './ctx';
import { NumField } from './inputs';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ORDER = [4, 5, 6, 0, 1, 2, 3] as const; // Thu first, like the prototype

const MENU_TYPES: { k: HHSetting['type'] | 'none'; label: string }[] = [
  { k: 'none', label: 'No happy hour' },
  { k: 'off', label: '$ off' },
  { k: 'pct', label: '% off' },
  { k: 'price', label: 'Set price' },
];

export function HHTab() {
  const app = useApp();
  const hh = app.working.settings.hh;
  const parents = app.working.settings.parents;
  const cats = orderedCategories(app.working.categories, parents);

  const setDay = (d: (typeof DAY_ORDER)[number], window: [string, string] | null) =>
    app.mutate((lib) => {
      if (window) lib.settings.hh.schedule[d] = window;
      else delete lib.settings.hh.schedule[d];
    });

  const setMenu = (c: string, next: HHSetting | null) =>
    app.mutate((lib) => {
      if (!next || next.type === 'none') delete lib.settings.hh.menus[c];
      else lib.settings.hh.menus[c] = next;
    });

  /**
   * Values carry across a type switch only between types that share a unit
   * ($ off ↔ set price, both cents). A percent never becomes cents or vice
   * versa — the old raw-carry turned "$5 off" into 500% off, pricing items
   * at $0 for the whole window.
   */
  const carriedValue = (from: HHSetting['type'], to: HHSetting['type'], value: number | undefined): number => {
    const centsTypes = ['off', 'price'];
    return centsTypes.includes(from) && centsTypes.includes(to) ? (value ?? 0) : 0;
  };

  return (
    <div className="hhgrid">
      <section className="pane">
        <h3>Schedule</h3>
        <p className="muted hint">
          Items ring in at happy hour prices inside these windows. Within 5 minutes of the end, before or
          after, the register asks. An end time earlier than the start runs into the next day.
        </p>
        <table className="tbl hhs">
          <tbody>
            {DAY_ORDER.map((d) => {
              const w = hh.schedule[d];
              const crosses = w && w[1] < w[0];
              return (
                <tr key={d}>
                  <td>{DAY_NAMES[d]}</td>
                  <td>
                    <label className="chk">
                      <input
                        type="checkbox"
                        checked={!!w}
                        onChange={(e) => setDay(d, e.target.checked ? ['16:00', '18:00'] : null)}
                      />{' '}
                      On
                    </label>
                  </td>
                  <td>
                    {w ? (
                      <>
                        <input type="time" value={w[0]} aria-label={`${DAY_NAMES[d]} start`} onChange={(e) => setDay(d, [e.target.value, w[1]])} /> –{' '}
                        <input type="time" value={w[1]} aria-label={`${DAY_NAMES[d]} end`} onChange={(e) => setDay(d, [w[0], e.target.value])} />
                        {crosses ? <span className="badge rv">into {DAY_NAMES[(d + 1) % 7]}</span> : null}
                      </>
                    ) : (
                      <span className="muted">No happy hour</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="pane">
        <h3>Menu pricing</h3>
        <p className="muted hint">
          Set per menu — never globally. A sub-menu without its own setting uses its parent's. Items can
          override this on their own page. Set price applies to menu items only; pours use $ or % off.
        </p>
        <table className="tbl">
          <tbody>
            {cats.map((c) => {
              const r = hh.menus[c] ?? { type: 'none' as const };
              const par = parents[c];
              return (
                <tr key={c}>
                  <td>
                    {par ? <span className="dim">{par} › </span> : null}
                    {c}
                  </td>
                  <td>
                    <select
                      value={r.type}
                      aria-label={`${c} happy hour`}
                      onChange={(e) => {
                        const to = e.target.value as HHSetting['type'];
                        setMenu(c, { type: to, value: carriedValue(r.type, to, r.value) });
                      }}
                    >
                      {MENU_TYPES.map((t) => (
                        <option key={t.k} value={t.k}>
                          {t.k === 'none' && par ? `Same as ${par}` : t.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="num">
                    {r.type === 'pct' ? (
                      <NumField label="" value={r.value ?? null} min={0} step={1} width={72} suffix="%" onCommit={(v) => setMenu(c, { type: 'pct', value: v ?? 0 })} />
                    ) : r.type === 'off' || r.type === 'price' ? (
                      <NumField
                        label=""
                        value={r.value != null ? r.value / 100 : null}
                        min={0}
                        step={0.5}
                        width={72}
                        suffix="$"
                        onCommit={(v) => setMenu(c, { type: r.type, value: v == null ? 0 : Math.round(v * 100) })}
                      />
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
