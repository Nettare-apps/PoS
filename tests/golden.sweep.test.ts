/**
 * Golden sweep: the integer-cents engine must agree with a float reference
 * implementation ported VERBATIM from the prototype, across the ENTIRE seed
 * library (every serving of all 256 pours, a grid of custom volumes, the
 * snap decision, item recipe costs, and happy-hour pricing on every product).
 *
 * The reference (tests/reference/prototype-ref.mjs) is the formulas Conner
 * approved button by button; the engine is an independent implementation.
 * Agreement across 377 products is the milestone-1 acceptance bar.
 */
import { describe, expect, it } from 'vitest';
import rawJson from '../data/pos_data.json';
import * as ref from './reference/prototype-ref.mjs';
import {
  customQuote,
  hhPrice,
  itemCost,
  isItem,
  isPour,
  resolveCustomRing,
  stdMatches,
  stdQuote,
  type HHRule,
  type MenuItem,
  type Pour,
} from '../src/engine';
import { seedLibrary } from '../src/library/seed';

interface RawProduct {
  id: string;
  kind?: string;
  name: string;
  price?: number;
  cost?: Record<string, number | null>;
  servings?: { override?: number | null }[];
  recipe?: { pid: string; ml: number }[];
  [k: string]: unknown;
}
const raw = rawJson as unknown as { products: RawProduct[] };

/** The prototype strips serving overrides at load (migrateLib migNoOverride). */
function refProducts(stripOverrides: boolean): RawProduct[] {
  const products = structuredClone(raw.products);
  if (stripOverrides) {
    for (const p of products) for (const s of p.servings ?? []) delete s.override;
  }
  return products;
}

const centsOf = (dollars: number | null): number | null => (dollars == null ? null : Math.round(dollars * 100));
/** The reference returns price 0/null as falsy; the engine mirrors with null-or-zero cents. */
const priceCents = (refPrice: number | null): number | null => (refPrice == null ? null : refPrice * 100);

function pairs(stripOverrides: boolean): { eng: Pour; raw: RawProduct }[] {
  const lib = seedLibrary({ stripOverrides });
  const rawById = new Map(refProducts(stripOverrides).map((p) => [p.id, p]));
  return lib.products.filter(isPour).map((eng) => ({ eng, raw: rawById.get(eng.id)! }));
}

describe('golden sweep vs the prototype reference', () => {
  it('prices every standard pour of all 256 pours identically (overrides stripped, as the prototype loads)', () => {
    let checked = 0;
    for (const { eng, raw: rp } of pairs(true)) {
      eng.servings.forEach((s, i) => {
        const q = stdQuote(eng, s);
        const rq = ref.stdPrice(rp, (rp.servings as never[])[i]);
        expect(q.ml, `${eng.id} serving ${i} ml`).toBe(rq.ml);
        expect(q.price, `${eng.id} serving ${i} price`).toBe(priceCents(rq.price));
        expect(q.basis, `${eng.id} serving ${i} basis`).toBe(rq.basis);
        expect(q.over, `${eng.id} serving ${i} over`).toBe(rq.over);
        expect(q.cost, `${eng.id} serving ${i} cost`).toBe(centsOf(rq.cost));
        if (rq.actual == null) expect(q.actual).toBeNull();
        else expect(q.actual, `${eng.id} serving ${i} actual`).toBe(rq.actual);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(500);
  });

  it('prices every standard pour identically with overrides kept', () => {
    for (const { eng, raw: rp } of pairs(false)) {
      eng.servings.forEach((s, i) => {
        const q = stdQuote(eng, s);
        const rq = ref.stdPrice(rp, (rp.servings as never[])[i]);
        expect(q.price, `${eng.id} serving ${i} price (override)`).toBe(priceCents(rq.price));
        expect(q.over, `${eng.id} serving ${i} over`).toBe(rq.over);
      });
    }
  });

  it('quotes a grid of custom volumes identically on every pour', () => {
    const ozEntries = [0.25, 0.5, 1, 1.5, 2, 2.5, 3, 5];
    for (const { eng, raw: rp } of pairs(true)) {
      const mlEntries = [
        15,
        50,
        100,
        375,
        eng.size / 10,
        eng.size / 10 + 0.01,
        eng.size * 0.55,
        eng.size - 1,
        eng.size,
        eng.size * 1.2,
      ];
      for (const [entries, unit] of [
        [ozEntries, 'oz'],
        [mlEntries, 'ml'],
      ] as const) {
        for (const entry of entries) {
          const q = customQuote(eng, entry, unit);
          const rq = ref.customQuote(rp, entry, unit);
          const tag = `${eng.id} custom ${entry}${unit}`;
          expect(q.ml, tag).toBe(rq.ml);
          expect(q.b, tag).toBe(rq.b);
          expect(q.pct, tag).toBe(rq.pct);
          expect(q.price, tag).toBe(priceCents(rq.price));
          expect(q.cost, tag).toBe(centsOf(rq.cost));
          expect(q.pricedCost, tag).toBe(centsOf(rq.pricedCost));
        }
      }
    }
  });

  it('makes the same snap decision as the prototype for every serving volume and its edges', () => {
    for (const { eng, raw: rp } of pairs(true)) {
      for (const s of eng.servings) {
        const base = ref.servingMl(s);
        for (const ml of [base, base + 0.9, base - 0.9, base + 1.2, base * 1.004, base * 1.006]) {
          const mine = stdMatches(eng, ml).map((m) => m.index);
          const theirs = ref.stdMatches(rp, ml).map((m: { i: number }) => m.i);
          expect(mine, `${eng.id} matches at ${ml}`).toEqual(theirs);

          const res = resolveCustomRing(eng, ml, 'ml');
          const rq = ref.customQuote(rp, ml, 'ml');
          const expected =
            theirs.length === 1 ? 'std' : theirs.length > 1 ? 'pick' : rq.price ? 'custom' : 'invalid';
          expect(res.kind, `${eng.id} ring at ${ml}`).toBe(expected);
        }
      }
    }
  });

  it('prices every menu item recipe cost identically', () => {
    const lib = seedLibrary();
    const lookup = (pid: string) => lib.products.find((p) => p.id === pid);
    const rawById = new Map(refProducts(true).map((p) => [p.id, p]));
    const refLookup = (pid: string) => rawById.get(pid);
    let withRecipes = 0;
    for (const item of lib.products.filter(isItem)) {
      const mine = itemCost(item as MenuItem, lookup);
      const theirs = ref.itemCost(rawById.get(item.id)!, refLookup);
      expect(mine, `${item.id} recipe cost`).toBe(Math.round(theirs * 100));
      if (item.recipe.length) withRecipes++;
    }
    expect(withRecipes).toBe(23);
  });

  it('computes identical happy-hour prices on every product for %, $ off and set price', () => {
    const lib = seedLibrary();
    const rawById = new Map(refProducts(true).map((p) => [p.id, p]));
    const scenarios: { eng: HHRule; ref: { type: string; value: number } }[] = [
      { eng: { type: 'pct', value: 20, from: 'x' }, ref: { type: 'pct', value: 20 } },
      { eng: { type: 'pct', value: 15, from: 'x' }, ref: { type: 'pct', value: 15 } },
      { eng: { type: 'off', value: 200, from: 'x' }, ref: { type: 'off', value: 2 } },
      { eng: { type: 'price', value: 900, from: 'x' }, ref: { type: 'price', value: 9 } },
    ];
    for (const p of lib.products) {
      const rp = rawById.get(p.id)!;
      // base price: the item price, or the pour's first priced serving
      let baseCents: number | null = null;
      let baseDollars: number | null = null;
      if (isItem(p)) {
        baseCents = p.price;
        baseDollars = (rp.price as number) ?? 0;
      } else {
        for (let i = 0; i < p.servings.length; i++) {
          const q = stdQuote(p, p.servings[i]!);
          if (q.price) {
            baseCents = q.price;
            baseDollars = ref.stdPrice(rp, (rp.servings as never[])[i]).price;
            break;
          }
        }
      }
      if (baseCents == null || baseDollars == null) continue;
      for (const sc of scenarios) {
        const mine = hhPrice(sc.eng, baseCents, isItem(p));
        const theirs = ref.hhPrice(sc.ref, baseDollars, rp);
        expect(mine, `${p.id} hh ${sc.eng.type}`).toBe(theirs == null ? null : Math.round(theirs * 100));
      }
    }
  });
});
