/**
 * Milestone 1 shell: proves the seed loads and the engine prices it.
 * The real library UI lands once Conner's open questions are answered;
 * nothing here is register UI.
 */
import { useMemo } from 'react';
import { formatCents, isItem, isPour, stdQuote, customQuote } from './engine';
import { seedLibrary } from './library/seed';

export function App() {
  const lib = useMemo(() => seedLibrary(), []);
  const pours = lib.products.filter(isPour);
  const items = lib.products.filter(isItem);
  const sample = pours.find((p) => p.name === 'Bank Note 5yr Peated') ?? pours[0]!;
  const custom = customQuote(sample, 1.5, 'oz');

  return (
    <main className="wrap">
      <h1>Pour Register</h1>
      <p className="muted">
        Production build — milestone 1 (library, pricing engine, event log) in progress. The
        register, floor and ticket come in later milestones.
      </p>
      <section>
        <h2>Seed library</h2>
        <p>
          {lib.products.length} products ({pours.length} pours, {items.length} menu items) ·{' '}
          {lib.categories.length} categories · {lib.mods.groups.length} modifier groups
        </p>
      </section>
      <section>
        <h2>Engine check: {sample.name}</h2>
        <table>
          <thead>
            <tr>
              <th>Serving</th>
              <th>Price</th>
              <th>Actual cost</th>
            </tr>
          </thead>
          <tbody>
            {sample.servings.map((s, i) => {
              const q = stdQuote(sample, s);
              return (
                <tr key={i}>
                  <td>{s.label ?? `${s.qty} ${s.unit}`}</td>
                  <td>{q.price != null ? formatCents(q.price) : '—'}</td>
                  <td>{q.actual != null ? `${q.actual.toFixed(1)}%` : '—'}</td>
                </tr>
              );
            })}
            <tr>
              <td>Custom 1.5 oz (bucket {custom.b})</td>
              <td>{custom.price != null ? formatCents(custom.price) : '—'}</td>
              <td>{custom.actual != null ? `${custom.actual.toFixed(1)}%` : '—'}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>
  );
}
