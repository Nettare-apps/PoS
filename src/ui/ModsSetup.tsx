/**
 * A product's modifier setup (SPEC §7): inherit what its menus carry, or its
 * own list of groups with rules.
 */
import type { ModAssignment, ModRule } from '../library/types';
import { useApp } from './ctx';

const RULES: { k: ModRule; label: string }[] = [
  { k: 'required', label: 'Required' },
  { k: 'force', label: 'Shown automatically' },
  { k: 'optional', label: 'Optional' },
];

export function ModsSetup(props: { productId: string; cats: string[] }) {
  const app = useApp();
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
          onChange={(e) =>
            e.target.checked
              ? app.mutate((d) => delete d.mods.items[props.productId])
              : setOwn((g) => g)
          }
        />
        Use the menu setup
      </label>
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
          <AddGroup existing={own.groups.map((g) => g.gid)} onAdd={(gid) => setOwn((g) => [...g, { gid, rule: 'optional' }])} />
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
