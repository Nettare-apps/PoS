/**
 * Pricing engine tests (SPEC §5). The dollar anchors were confirmed against
 * the live prototype on 2026-10-27 (Bank Note 5yr Peated: $6 / $11 / $33,
 * custom 1.5 oz $9, custom 44 mL $8).
 */
import { describe, expect, it } from 'vitest';
import {
  bucket,
  customQuote,
  itemCost,
  lowPerMl,
  perMl,
  resolveCustomRing,
  servingMl,
  stdMatches,
  stdQuote,
} from './pricing';
import { OZ_TO_ML } from './units';
import type { MenuItem, Pour, Serving } from './types';

const sv = (qty: number, unit: 'oz' | 'ml', target: number, extra: Partial<Serving> = {}): Serving => ({
  qty,
  unit,
  target,
  basis: 'frontline',
  ...extra,
});

const mkPour = (extra: Partial<Pour> = {}): Pour => ({
  kind: 'pour',
  id: 'p1',
  name: 'Bank Note 5yr Peated',
  cats: ['Whisky'],
  primary: 'Whisky',
  size: 750,
  pack: 1,
  cost: { frontline: 2170, net: null, sale: null },
  basis: 'frontline',
  scale: { min: 15, max: 25 },
  servings: [sv(1, 'oz', 15, { label: '1 oz' }), sv(2, 'oz', 15, { label: '2 oz' }), sv(750, 'ml', 65, { label: 'Retail bottle' })],
  ...extra,
});

describe('servingMl', () => {
  it('converts oz at the prototype constant', () => {
    expect(servingMl(sv(1, 'oz', 15))).toBe(OZ_TO_ML);
    expect(servingMl(sv(750, 'ml', 65))).toBe(750);
  });
});

describe('stdQuote (standard pours)', () => {
  const p = mkPour();
  it('prices 1 oz at 15% of frontline $21.70 as $6 (whole dollars)', () => {
    const q = stdQuote(p, p.servings[0]!);
    expect(q.price).toBe(600);
    expect(q.actual).toBeCloseTo(14.26, 1);
    expect(q.over).toBe(false);
  });
  it('prices 2 oz as $11 and the 750 mL bottle at 65% as $33', () => {
    expect(stdQuote(p, p.servings[1]!).price).toBe(1100);
    const bottle = stdQuote(p, p.servings[2]!);
    expect(bottle.price).toBe(3300);
    expect(bottle.actual).toBeCloseTo(65.76, 1);
  });
  it('theoretical cost uses the lowest cost on file, independent of the pricing basis', () => {
    const p2 = mkPour({ cost: { frontline: 2170, net: 1800, sale: 2500 }, basis: 'sale' });
    // priced from sale, but cost from net (the lowest)
    const q = stdQuote(p2, p2.servings[0]!);
    expect(q.basis).toBe('frontline'); // the serving's own basis wins over the product's
    expect(lowPerMl(p2)).toBeCloseTo(1800 / 100 / 750, 10);
    expect(q.cost).toBe(Math.round((18 / 750) * OZ_TO_ML * 100));
  });
  it('serving basis falls back to the product basis', () => {
    const p2 = mkPour({ basis: 'net', cost: { frontline: 2170, net: 1500, sale: null } });
    const s = { ...sv(1, 'oz', 15), basis: undefined as unknown as 'net' };
    expect(stdQuote(p2, s).basis).toBe('net');
  });
  it('a manual override replaces the derived price, rounded to the whole dollar', () => {
    const q = stdQuote(mkPour(), sv(1, 'oz', 15, { override: 900 }));
    expect(q.price).toBe(900);
    expect(q.over).toBe(true);
    // $9.50 rounds to $10, half-up like the prototype's Math.round
    expect(stdQuote(mkPour(), sv(1, 'oz', 15, { override: 950 })).price).toBe(1000);
    // zero/absent overrides don't count
    expect(stdQuote(mkPour(), sv(1, 'oz', 15, { override: 0 })).over).toBe(false);
  });
  it('is unpriceable without a positive cost on the basis or a positive target', () => {
    const noCost = mkPour({ cost: { frontline: null, net: null, sale: null } });
    expect(stdQuote(noCost, noCost.servings[0]!).price).toBeNull();
    expect(stdQuote(noCost, noCost.servings[0]!).cost).toBeNull();
    expect(stdQuote(mkPour(), sv(1, 'oz', 0)).price).toBeNull();
  });
});

describe('bucket (custom-pour sliding scale)', () => {
  const p = mkPour();
  it('splits the container into 10 buckets and slides 15% → 25%', () => {
    expect(bucket(p, 1)).toMatchObject({ b: 1, pct: 15 });
    expect(bucket(p, 375).b).toBe(5);
    expect(bucket(p, 375).pct).toBeCloseTo(15 + (10 * 4) / 9, 10);
    expect(bucket(p, 750)).toMatchObject({ b: 10, pct: 25 });
  });
  it('a volume exactly on a boundary falls in the lower bucket', () => {
    expect(bucket(p, 75).b).toBe(1);
    expect(bucket(p, 75.001).b).toBe(2);
    expect(bucket(p, 150).b).toBe(2);
  });
  it('volumes over the container clamp to the top bucket', () => {
    expect(bucket(p, 1000)).toMatchObject({ b: 10, pct: 25 });
  });
});

describe('customQuote', () => {
  const p = mkPour();
  it('prices 1.5 oz in bucket 1 at $9 — and the same pour typed as 44 mL at $8', () => {
    // the oz/mL $1 shift is real prototype behavior, flagged to Conner
    expect(customQuote(p, 1.5, 'oz')).toMatchObject({ b: 1, pct: 15, price: 900 });
    expect(customQuote(p, 44, 'ml')).toMatchObject({ b: 1, pct: 15, price: 800 });
  });
  it('carries theoretical cost on the lowest basis and priced cost on the product basis', () => {
    const q = customQuote(p, 1.5, 'oz');
    expect(q.cost).toBe(Math.round((2170 / 100 / 750) * 1.5 * OZ_TO_ML * 100));
    expect(q.pricedCost).toBe(q.cost); // only frontline on file
  });
});

describe('snapping (stdMatches / resolveCustomRing)', () => {
  const p = mkPour();
  it('a volume within max(1 mL, 0.5%) of a standard snaps to it', () => {
    expect(stdMatches(p, OZ_TO_ML).map((m) => m.index)).toEqual([0]);
    expect(stdMatches(p, 29).map((m) => m.index)).toEqual([0]); // 0.57 mL off
    expect(stdMatches(p, 28)).toEqual([]); // 1.57 mL off
    const r = resolveCustomRing(p, 1, 'oz');
    expect(r.kind).toBe('std');
    if (r.kind === 'std') expect(r.match.quote.price).toBe(600);
  });
  it('several matching standards mean the bartender picks — custom is not offered', () => {
    const p2 = mkPour({
      servings: [sv(750, 'ml', 65, { label: 'Retail bottle' }), sv(750, 'ml', 55, { label: 'Sale retail' })],
    });
    const r = resolveCustomRing(p2, 750, 'ml');
    expect(r.kind).toBe('pick');
    if (r.kind === 'pick') expect(r.matches.map((m) => m.index)).toEqual([0, 1]);
  });
  it('unpriceable servings never match', () => {
    const p2 = mkPour({ servings: [sv(1, 'oz', 0)] });
    expect(resolveCustomRing(p2, 1, 'oz').kind).toBe('custom');
  });
  it('rejects empty and unpriceable entries', () => {
    expect(resolveCustomRing(p, 0, 'oz').kind).toBe('invalid');
    expect(resolveCustomRing(p, NaN, 'oz').kind).toBe('invalid');
    const noCost = mkPour({ cost: { frontline: null, net: null, sale: null } });
    expect(resolveCustomRing(noCost, 2.2, 'oz').kind).toBe('invalid');
  });
});

describe('itemCost', () => {
  it('sums recipe volumes at each product’s lowest cost on file', () => {
    const p = mkPour({ cost: { frontline: 2170, net: 1500, sale: null } });
    const item: MenuItem = {
      kind: 'item',
      id: 'i1',
      name: 'Old Fashioned',
      cats: ['Cocktails'],
      primary: 'Cocktails',
      price: 1600,
      recipe: [{ pid: 'p1', ml: 60 }],
    };
    const lookup = (pid: string) => (pid === 'p1' ? p : undefined);
    expect(itemCost(item, lookup)).toBe(Math.round((1500 / 100 / 750) * 60 * 100));
    expect(itemCost({ ...item, recipe: [] }, lookup)).toBe(0);
    // unknown products contribute nothing
    expect(itemCost({ ...item, recipe: [{ pid: 'nope', ml: 60 }] }, lookup)).toBe(0);
  });
});

describe('perMl', () => {
  it('returns null for missing or non-positive costs', () => {
    expect(perMl(mkPour({ cost: { frontline: 0, net: null, sale: null } }))).toBeNull();
    expect(perMl(mkPour(), 'net')).toBeNull();
  });
});
