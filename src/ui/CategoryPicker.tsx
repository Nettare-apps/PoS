/** Multi-tag category chips with a primary (reporting) choice (SPEC §7). */
import { fixPrimary } from '../library/normalize';
import { orderedCategories } from '../library/categories';
import type { Product } from '../engine/types';
import { useApp } from './ctx';

export function CategoryPicker(props: { product: Product }) {
  const app = useApp();
  const p = props.product;
  const cats = orderedCategories(app.working.categories, app.working.settings.parents);
  const toggle = (c: string) =>
    app.mutate((d) => {
      const dp = d.products.find((x) => x.id === p.id);
      if (!dp) return;
      dp.cats = dp.cats.includes(c) ? dp.cats.filter((x) => x !== c) : [...dp.cats, c];
      fixPrimary(dp);
    });
  const setPrimary = (c: string) =>
    app.mutate((d) => {
      const dp = d.products.find((x) => x.id === p.id);
      if (dp && dp.cats.includes(c)) dp.primary = c;
    });

  return (
    <section className="fs">
      <h3>Categories</h3>
      <div className="chips">
        {cats.map((c) => (
          <button
            key={c}
            className={`chip${app.working.settings.parents[c] ? ' child' : ''}`}
            aria-pressed={p.cats.includes(c)}
            onClick={() => toggle(c)}
          >
            {c}
          </button>
        ))}
      </div>
      {p.cats.length > 1 ? (
        <label className="f inline">
          <span className="lbl">Reporting category</span>
          <select value={p.primary ?? ''} onChange={(e) => setPrimary(e.target.value)}>
            {p.cats.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </section>
  );
}
