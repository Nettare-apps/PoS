/**
 * The per-item happy hour setting (SPEC §14): inherit from the menus, opt
 * out, or $ off / % off / set price — set price for menu items only.
 * Applies to the base price at ring-in, never to modifier upcharges.
 */
import { hhRule } from '../engine/happyHour';
import { isItem, type HHSetting, type Product } from '../engine/types';
import { useApp } from './ctx';
import { NumField } from './inputs';

const TYPES: { k: HHSetting['type']; label: string }[] = [
  { k: 'inherit', label: 'Use menu setting' },
  { k: 'none', label: 'No happy hour' },
  { k: 'off', label: '$ off' },
  { k: 'pct', label: '% off' },
  { k: 'price', label: 'Set price (menu items only)' },
];

export function HHOverride(props: { product: Product }) {
  const app = useApp();
  const p = props.product;
  const setting: HHSetting = p.hh ?? { type: 'inherit' };
  const inherited = hhRule(app.working.settings.hh.menus, app.working.settings.parents, {
    ...p,
    hh: undefined,
  } as Product);
  const set = (fn: (hh: HHSetting) => HHSetting | undefined) =>
    app.mutate((d) => {
      const dp = d.products.find((x) => x.id === p.id);
      if (!dp) return;
      const next = fn(dp.hh ?? { type: 'inherit' });
      if (!next || next.type === 'inherit') delete dp.hh;
      else dp.hh = next;
    });

  const inheritLabel = inherited
    ? ` (${inherited.type === 'pct' ? `${inherited.value}% off` : inherited.type === 'off' ? `$${inherited.value / 100} off` : `HH $${inherited.value / 100}`} from ${inherited.from})`
    : ' (none)';

  return (
    <section className="fs">
      <h3>Happy hour</h3>
      <div className="row2">
        <label className="f">
          <span className="lbl">Pricing</span>
          <select
            value={setting.type}
            onChange={(e) => set(() => ({ type: e.target.value as HHSetting['type'] }))}
          >
            {TYPES.map((t) => (
              <option key={t.k} value={t.k} disabled={t.k === 'price' && !isItem(p)}>
                {t.k === 'inherit' ? `Use menu setting${inheritLabel}` : t.label}
              </option>
            ))}
          </select>
        </label>
        {setting.type === 'pct' ? (
          <NumField label="Percent" value={setting.value ?? null} min={0} step={1} onCommit={(v) => set((hh) => ({ ...hh, value: v ?? 0 }))} />
        ) : setting.type === 'off' || setting.type === 'price' ? (
          <NumField
            label="Dollars"
            value={setting.value != null ? setting.value / 100 : null}
            min={0}
            step={0.5}
            onCommit={(v) => set((hh) => ({ ...hh, value: v == null ? 0 : Math.round(v * 100) }))}
          />
        ) : null}
      </div>
      <p className="muted hint">Applies to the base price at ring-in, not modifiers. Pours get $ or % off per serving.</p>
    </section>
  );
}
