/**
 * A product's modifier setup (SPEC §7): inherit what its menus carry, or its
 * own list of groups with rules.
 */
import { useState } from 'react';
import type { ModAssignment, ModRule } from '../library/types';
import { useApp } from './ctx';

const RULES: { k: ModRule; label: string }[] = [
  { k: 'required', label: 'Required' },
  { k: 'force', label: 'Shown automatically' },
  { k: 'optional', label: 'Optional' },
];

export function ModsSetup(props: { productId: string; cats: string[]; productName?: string }) {
  const app = useApp();
  const [confirmInherit, setConfirmInherit] = useState(false);
  const { mods, settings } = app.working;
  const own = mods.items[props.productId];

  // what the menus would give this product (direct categories, then parents)
  const inherited: (ModAssignment & { from: string })[] = [];
  const seen = new Set<string>();
  const take = (c: string) =>
    (mods.menus[c] ?? []).forEach((a) => {
      if (!seen.has(a.gid)) {
        seen.add(a.gid);
        inherited.push({ ...a, from: c });
      }
    });
  props.cats.forEach(take);
  props.cats.forEach((c) => settings.parents[c] && take(settings.parents[c]!));

  const groupName = (gid: string) => mods.groups.find((g) => g.id === gid)?.name ?? gid;
  const setOwn = (fn: (groups: ModAssignment[]) => ModAssignment[]) =>
    app.mutate((d) => {
      const cur = d.mods.items[props.productId] ?? {
        inherit: false as const,
        groups: inherited.map(({ gid, rule }) => ({ gid, rule })),
      };
      d.mods.items[props.productId] = { inherit: false, groups: fn(cur.groups) };
    });

  return (
    <section className="fs">
      <h3>Modifiers</h3>
      <label className="chk">
        <input
          type="checkbox"
          checked={!own}
          onChange={(e) => {
            if (!e.target.checked) return setOwn((g) => g);
            // going back to the menu setup throws this product's own setup away — confirm first
            if (own && own.groups.length) setConfirmInherit(true);
            else app.mutate((d) => delete d.mods.items[props.productId]);
          }}
        />
        Use the menu setup
      </label>
      {confirmInherit ? (
        <p className="warnbox" role="alert">
          Drop this product's own modifier setup ({own?.groups.length} group{own?.groups.length === 1 ? '' : 's'}) and go back to the menus?
          <button className="btn sm" onClick={() => setConfirmInherit(false)}>
            Keep it
          </button>
          <button
            className="btn sm danger"
            onClick={() => {
              app.mutate((d) => delete d.mods.items[props.productId]);
              setConfirmInherit(false);
            }}
          >
            Use the menus
          </button>
        </p>
      ) : null}
      {!own ? (
        <ul className="modlist muted">
          {inherited.length ? (
            inherited.map((a) => (
              <li key={a.gid}>
                {groupName(a.gid)} — {RULES.find((r) => r.k === a.rule)?.label} <span className="dim">via {a.from}</span>
              </li>
            ))
          ) : (
            <li>No groups from this product's menus.</li>
          )}
        </ul>
      ) : (
        <>
          <ul className="modlist">
            {own.groups.map((a, i) => (
              <li key={`${a.gid}-${i}`}>
                <span>{groupName(a.gid)}</span>
                <select value={a.rule} onChange={(e) => setOwn((g) => g.map((x, j) => (j === i ? { ...x, rule: e.target.value as ModRule } : x)))} aria-label={`Rule for ${groupName(a.gid)}`}>
                  {RULES.map((r) => (
                    <option key={r.k} value={r.k}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <button className="btn sm" onClick={() => setOwn((g) => g.filter((_, j) => j !== i))} aria-label={`Remove ${groupName(a.gid)}`}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <div className="row-btns">
            <AddGroup existing={own.groups.map((g) => g.gid)} onAdd={(gid) => setOwn((g) => [...g, { gid, rule: 'optional' }])} />
            <button
              className="btn sm"
              onClick={() => {
                // SPEC §7: a new group can be created from an item's page; it stays a
                // group, tied to this item only until assigned to menus
                const gid = `g${Date.now().toString(36)}`;
                app.mutate((d) => {
                  d.mods.groups.push({ id: gid, name: `${props.productName ?? 'Item'} options`, multi: true, items: [] });
                  const cur = d.mods.items[props.productId] ?? { inherit: false as const, groups: [] };
                  cur.groups = [...cur.groups, { gid, rule: 'optional' }];
                  d.mods.items[props.productId] = cur;
                });
              }}
            >
              + New group for this item
            </button>
          </div>
          <p className="muted hint">A group made here stays tied to this item until it is assigned to menus in the Modifiers tab.</p>
        </>
      )}
    </section>
  );
}

function AddGroup(props: { existing: string[]; onAdd: (gid: string) => void }) {
  const app = useApp();
  const options = app.working.mods.groups.filter((g) => !props.existing.includes(g.id));
  if (!options.length) return null;
  return (
    <select
      value=""
      aria-label="Add a modifier group"
      onChange={(e) => e.target.value && props.onAdd(e.target.value)}
    >
      <option value="">+ Add a group…</option>
      {options.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
        </option>
      ))}
    </select>
  );
}
