/**
 * The Products tab (SPEC §7): the list stays pinned on the left with its own
 * scroll; the editor scrolls with the page. Search, category chips (parents
 * included), new pour / new item, and Manage categories.
 */
import { useMemo, useState } from 'react';
import { formatCents } from '../engine/money';
import { stdQuote } from '../engine/pricing';
import { isItem, isPour, type Product } from '../engine/types';
import { inCategory, orderedCategories } from '../library/categories';
import { fixPrimary } from '../library/normalize';
import { CategoriesManager } from './CategoriesManager';
import { useApp } from './ctx';
import { ItemForm } from './ItemForm';
import { ProductForm } from './ProductForm';

function fromPrice(p: Product): string {
  if (isItem(p)) return formatCents(p.price);
  const priced = p.servings.map((s) => stdQuote(p, s).price).filter((x): x is number => x != null && x > 0);
  return priced.length ? `from ${formatCents(Math.min(...priced))}` : '—';
}

export function ProductsTab() {
  const app = useApp();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('All');
  const [sel, setSel] = useState<string | null>(null);
  const [manageCats, setManageCats] = useState(false);
  const { working } = app;

  const cats = ['All', ...orderedCategories(working.categories, working.settings.parents)];
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return working.products.filter(
      (p) =>
        (cat === 'All' || inCategory(working.settings.parents, p, cat)) &&
        (!q || p.name.toLowerCase().includes(q) || p.cats.some((c) => c.toLowerCase().includes(q))),
    );
  }, [working, query, cat]);

  const selected = working.products.find((p) => p.id === sel) ?? list[0] ?? working.products[0];

  const addProduct = (kind: 'pour' | 'item') => {
    const id = `n${kind === 'pour' ? 'p' : 'i'}${Date.now().toString(36)}`;
    const cats0 = cat !== 'All' ? [cat] : [];
    app.mutate((d) => {
      const base = { id, name: kind === 'pour' ? 'New pour' : 'New item', cats: cats0.length ? cats0 : [d.categories[0]!], primary: null, section: '' };
      if (kind === 'pour') {
        d.products.unshift({
          ...base,
          kind: 'pour',
          size: 750,
          pack: 1,
          cost: { frontline: null, net: null, sale: null },
          basis: 'frontline',
          scale: { min: 15, max: 25 },
          servings: [{ qty: 1, unit: 'oz', target: 15, basis: 'frontline' }],
        });
      } else {
        d.products.unshift({ ...base, kind: 'item', price: 0, placeholder: true, recipe: [] });
      }
      fixPrimary(d.products[0]!);
    });
    setSel(id);
  };

  return (
    <div className="lib">
      <nav className="pane libnav" aria-label="Products">
        <div className="libtools">
          <input
            type="search"
            placeholder="Search products"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search products"
          />
          <div className="chips">
            {cats.map((c) => (
              <button key={c} className={`chip${working.settings.parents[c] ? ' child' : ''}`} aria-pressed={cat === c} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="row-btns">
            <button className="btn sm" onClick={() => addProduct('pour')}>
              + New pour
            </button>
            <button className="btn sm" onClick={() => addProduct('item')}>
              + New item
            </button>
            <button className="btn sm" aria-pressed={manageCats} onClick={() => setManageCats((m) => !m)}>
              Manage categories
            </button>
          </div>
        </div>
        <ul className="plist">
          {list.map((p) => (
            <li key={p.id}>
              <button aria-pressed={selected?.id === p.id} onClick={() => { setSel(p.id); setManageCats(false); }}>
                <span>
                  {p.name}
                  {isItem(p) && p.placeholder ? <span className="badge ph">placeholder</span> : null}
                </span>
                <span className="num muted">{fromPrice(p)}</span>
              </button>
            </li>
          ))}
          {!list.length ? <li className="muted empty">Nothing matches.</li> : null}
        </ul>
      </nav>
      <section className="pane editor">
        {manageCats ? (
          <CategoriesManager />
        ) : selected ? (
          isPour(selected) ? (
            <ProductForm key={selected.id} pour={selected} onDeleted={() => setSel(null)} />
          ) : (
            <ItemForm key={selected.id} item={selected} onDeleted={() => setSel(null)} />
          )
        ) : (
          <p className="muted">Pick a product.</p>
        )}
      </section>
    </div>
  );
}
