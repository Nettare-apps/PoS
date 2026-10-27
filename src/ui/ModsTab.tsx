/**
 * The modifiers manager (SPEC §7): groups with items (price + optional
 * product link for depletion), each group assigned to menus with a rule.
 * Seats and Course are built in.
 */
import { useState } from 'react';
import { isPour } from '../engine/types';
import { OZ_TO_ML } from '../engine/units';
import { orderedCategories } from '../library/categories';
import type { ModGroup, ModRule } from '../library/types';
import { useApp } from './ctx';
import { MoneyField, NumField, TextField } from './inputs';

const RULES: { k: ModRule | ''; label: string }[] = [
  { k: '', label: '—' },
  { k: 'required', label: 'Required' },
  { k: 'force', label: 'Shown automatically' },
  { k: 'optional', label: 'Optional' },
];

export function ModsTab() {
  const app = useApp();
  const { mods } = app.working;
  const [sel, setSel] = useState<string>(mods.groups[0]?.id ?? '');
  const group = mods.groups.find((g) => g.id === sel) ?? mods.groups[0];

  const addGroup = () => {
    const id = `g${Date.now().toString(36)}`;
    // prototype default: a new group is pick-any (multi)
    app.mutate((d) => d.mods.groups.push({ id, name: 'New group', multi: true, items: [] }));
    setSel(id);
  };

  return (
    <div className="lib">
      <nav className="pane libnav" aria-label="Modifier groups">
        <ul className="plist">
          {mods.groups.map((g) => (
            <li key={g.id}>
              <button aria-pressed={group?.id === g.id} onClick={() => setSel(g.id)}>
                <span>
                  {g.name}
                  {g.kind ? <span className="badge cur">built-in</span> : null}
                  {g.alert ? <span className="badge rv">alert</span> : null}
                </span>
                <span className="num muted">{g.items.length}</span>
              </button>
            </li>
          ))}
        </ul>
        <button className="btn sm" onClick={addGroup}>
          + New group
        </button>
      </nav>
      <section className="pane editor">{group ? <GroupForm key={group.id} group={group} onDeleted={() => setSel(mods.groups[0]?.id ?? '')} /> : null}</section>
    </div>
  );
}

function GroupForm(props: { group: ModGroup; onDeleted: () => void }) {
  const app = useApp();
  const g = props.group;
  const [confirmDel, setConfirmDel] = useState(false);
  const builtIn = !!g.kind;
  const edit = (fn: (dg: ModGroup) => void) =>
    app.mutate((d) => {
      const dg = d.mods.groups.find((x) => x.id === g.id);
      if (dg) fn(dg);
    });
  const cats = orderedCategories(app.working.categories, app.working.settings.parents);
  const ruleFor = (c: string): ModRule | '' => app.working.mods.menus[c]?.find((a) => a.gid === g.id)?.rule ?? '';
  const setRule = (c: string, rule: ModRule | '') =>
    app.mutate((d) => {
      const list = (d.mods.menus[c] ?? []).filter((a) => a.gid !== g.id);
      if (rule) list.push({ gid: g.id, rule });
      if (list.length) d.mods.menus[c] = list;
      else delete d.mods.menus[c];
    });
  const pours = app.working.products.filter(isPour);

  return (
    <div className="pform">
      <div className="fhead">
        <TextField label="Group name" value={g.name} onCommit={(v) => v.trim() && edit((dg) => (dg.name = v.trim()))} />
        <label className="chk">
          <input type="checkbox" checked={g.multi} disabled={builtIn} onChange={(e) => edit((dg) => (dg.multi = e.target.checked))} />
          Multi-select
        </label>
        <label className="chk">
          <input type="checkbox" checked={!!g.alert} onChange={(e) => edit((dg) => (dg.alert = e.target.checked || undefined))} />
          Alert group (flags the ticket and KDS)
        </label>
      </div>
      {g.kind === 'seat' ? (
        <p className="muted hint">Seats are built in: Share (table) plus seat numbers from the table's layout or party size. No items to edit.</p>
      ) : g.kind === 'course' ? (
        <section className="fs">
          <h3>Courses</h3>
          <p className="muted hint">Course order is the firing order (SPEC §8). One course per item; no prices or depletion here.</p>
          <ul className="modlist">
            {g.items.map((it, i) => (
              <li key={it.id}>
                <TextField label="" value={it.name} onCommit={(v) => v.trim() && edit((dg) => (dg.items[i]!.name = v.trim()))} />
                <button className="btn sm" aria-label={`Move ${it.name} up`} disabled={i === 0} onClick={() => edit((dg) => dg.items.splice(i - 1, 0, dg.items.splice(i, 1)[0]!))}>
                  ↑
                </button>
                <button className="btn sm" aria-label={`Move ${it.name} down`} disabled={i === g.items.length - 1} onClick={() => edit((dg) => dg.items.splice(i + 1, 0, dg.items.splice(i, 1)[0]!))}>
                  ↓
                </button>
                <button className="btn sm" aria-label={`Remove ${it.name}`} onClick={() => edit((dg) => dg.items.splice(i, 1))}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button className="btn sm" onClick={() => edit((dg) => dg.items.push({ id: `c${Date.now().toString(36)}`, name: 'New course', price: 0, link: null }))}>
            + Add course
          </button>
        </section>
      ) : (
        <section className="fs">
          <h3>Items</h3>
          <div className="scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th className="num">Price $</th>
                <th>Depletes</th>
                <th className="num">Amount (oz)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {g.items.map((it, i) => (
                <tr key={it.id}>
                  <td>
                    <TextField label="" value={it.name} onCommit={(v) => edit((dg) => (dg.items[i]!.name = v))} />
                  </td>
                  <td className="num">
                    <MoneyField label="" cents={it.price} step={0.5} width={72} onCommit={(v) => edit((dg) => (dg.items[i]!.price = v ?? 0))} />
                  </td>
                  <td>
                    <select
                      value={it.link?.pid ?? ''}
                      aria-label={`${it.name} depletes`}
                      onChange={(e) =>
                        edit((dg) => {
                          const pid = e.target.value;
                          dg.items[i]!.link = pid ? { pid, ml: dg.items[i]!.link?.ml ?? OZ_TO_ML } : null;
                        })
                      }
                    >
                      <option value="">—</option>
                      {pours.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="num">
                    {it.link ? (
                      // entered in oz like the prototype; stored in mL like every line
                      <NumField
                        label=""
                        value={+(it.link.ml / OZ_TO_ML).toFixed(2)}
                        min={0}
                        step={0.25}
                        width={64}
                        onCommit={(v) => v != null && v > 0 && edit((dg) => (dg.items[i]!.link = { pid: dg.items[i]!.link!.pid, ml: v * OZ_TO_ML }))}
                      />
                    ) : null}
                  </td>
                  <td>
                    <button className="btn sm" aria-label={`Remove ${it.name}`} onClick={() => edit((dg) => dg.items.splice(i, 1))}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <button className="btn sm" onClick={() => edit((dg) => dg.items.push({ id: `${g.id}-${Date.now().toString(36)}`, name: 'New option', price: 0, link: null }))}>
            + Add item
          </button>
        </section>
      )}

      <section className="fs">
        <h3>Menus</h3>
        <p className="muted hint">Where this group appears and its rule: required, shown automatically, or optional.</p>
        <div className="menugrid">
          {cats.map((c) => (
            <label key={c} className="f inline">
              <span className="lbl">
                {app.working.settings.parents[c] ? <span className="dim">{app.working.settings.parents[c]} › </span> : null}
                {c}
              </span>
              <select value={ruleFor(c)} onChange={(e) => setRule(c, e.target.value as ModRule | '')}>
                {RULES.map((r) => (
                  <option key={r.k} value={r.k}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>

      {!builtIn ? (
        <section className="fs danger-zone">
          {confirmDel ? (
            <>
              <span className="warnbox">Delete the {g.name} group? It is removed from every menu and item setup.</span>
              <button className="btn sm" onClick={() => setConfirmDel(false)}>
                Keep it
              </button>
              <button
                className="btn sm danger"
                onClick={() => {
                  app.mutate((d) => {
                    d.mods.groups = d.mods.groups.filter((x) => x.id !== g.id);
                    for (const [c, list] of Object.entries(d.mods.menus)) {
                      d.mods.menus[c] = list.filter((a) => a.gid !== g.id);
                      if (!d.mods.menus[c]!.length) delete d.mods.menus[c];
                    }
                    for (const setup of Object.values(d.mods.items)) {
                      setup.groups = setup.groups.filter((a) => a.gid !== g.id);
                    }
                  });
                  props.onDeleted();
                }}
              >
                Delete group
              </button>
            </>
          ) : (
            <button className="btn sm" onClick={() => setConfirmDel(true)}>
              Delete this group…
            </button>
          )}
        </section>
      ) : null}
    </div>
  );
}
