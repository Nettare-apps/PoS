/**
 * The pricing engine (SPEC §5). Pure functions, no I/O.
 *
 * Each function cites the prototype lines it is faithful to
 * (prototype/pour-register.html). Base pour prices are whole dollars
 * (returned as cents, multiples of 100); theoretical costs are exact cents.
 */
import { OZ_TO_ML, toMl, type VolumeUnit } from './units';
import { centsFromDollars, type Cents } from './money';
import {
  COST_BASES,
  isPour,
  type CostBasis,
  type MenuItem,
  type Pour,
  type Product,
  type Serving,
} from './types';

/** Serving volume in mL (prototype servingMl, line 630). */
export function servingMl(s: Serving): number {
  return s.unit === 'oz' ? s.qty * OZ_TO_ML : s.qty;
}

/** Container cost in dollars on a basis; null when missing or not positive (lines 631, 635). */
function costDollars(p: Pour, basis: CostBasis): number | null {
  const c = p.cost[basis];
  return c != null && c > 0 ? c / 100 : null;
}

/** Dollars per mL on a basis; defaults to the product's basis (perMl/perMlFor, lines 632, 635). */
export function perMl(p: Pour, basis: CostBasis = p.basis): number | null {
  const c = costDollars(p, basis);
  return c != null ? c / p.size : null;
}

/**
 * Theoretical cost per mL: always the lowest of frontline, net and sale —
 * "that is what was actually paid" — independent of the pricing basis
 * (SPEC §5; prototype lowPerMl, line 634).
 */
export function lowPerMl(p: Pour): number | null {
  const v = COST_BASES.map((b) => perMl(p, b)).filter((x): x is number => x != null);
  return v.length ? Math.min(...v) : null;
}

/**
 * Whole-dollar price in cents for a volume at a cost %: perMl × mL ÷ (pct/100),
 * rounded to the dollar (prototype priceAt, line 636). Uses the product's
 * basis — custom pours price from it (see Q4).
 */
export function priceAt(p: Pour, ml: number, pct: number): Cents | null {
  const r = perMl(p);
  return r != null && pct > 0 ? Math.round((r * ml) / (pct / 100)) * 100 : null;
}

export interface Bucket {
  /** bucket number, 1–10 */
  b: number;
  /** cost % for this bucket */
  pct: number;
  /** bucket lower bound, mL (exclusive except bucket 1) */
  lo: number;
  /** bucket upper bound, mL (inclusive) */
  hi: number;
}

/**
 * Custom-pour sliding scale (SPEC §5; prototype bucket, lines 637-642).
 * The container splits into 10 buckets; the cost % slides linearly from
 * scale.min (bucket 1) to scale.max (bucket 10). A volume exactly on a
 * boundary falls in the lower bucket; volumes over the container clamp to
 * bucket 10 ("priced at the top bucket").
 */
export function bucket(p: Pour, ml: number): Bucket {
  const step = p.size / 10;
  const b = Math.min(10, Math.max(1, Math.ceil(ml / step - 1e-9)));
  const pct = p.scale.min + ((p.scale.max - p.scale.min) * (b - 1)) / 9;
  return { b, pct, lo: (b - 1) * step, hi: b * step };
}

export interface StdQuote {
  /** the serving's volume in mL */
  ml: number;
  /** whole-dollar price in cents; null when unpriceable, 0 when the derivation rounds to zero */
  price: Cents | null;
  /** actual cost % after rounding; null when there is no usable price */
  actual: number | null;
  /** true when a manual override set the price */
  over: boolean;
  /** the basis the price was derived from */
  basis: CostBasis;
  /** theoretical cost in cents (lowest cost on file × mL); null when no cost is on file */
  cost: Cents | null;
}

/**
 * Standard pour quote (prototype stdPrice, lines 643-650).
 * An override (> 0) replaces the derived price, rounded to the whole dollar.
 */
export function stdQuote(p: Pour, s: Serving): StdQuote {
  const ml = servingMl(s);
  const basis = s.basis || p.basis;
  const r = perMl(p, basis);
  const over = s.override != null && s.override > 0;
  const price = over
    ? Math.round((s.override as Cents) / 100) * 100
    : r != null && s.target > 0
      ? Math.round((r * ml) / (s.target / 100)) * 100
      : null;
  const actual = price != null && price > 0 && r != null ? ((r * ml) / (price / 100)) * 100 : null;
  const lo = lowPerMl(p);
  return { ml, price, actual, over, basis, cost: lo != null ? centsFromDollars(lo * ml) : null };
}

export interface CustomQuote extends Bucket {
  /** entered volume in mL */
  ml: number;
  /** whole-dollar price in cents at the bucket's cost %; null when unpriceable */
  price: Cents | null;
  /** theoretical cost in cents (lowest basis) */
  cost: Cents | null;
  /** cost in cents on the pricing basis (shown next to the gauge) */
  pricedCost: Cents | null;
  /** actual cost % after rounding */
  actual: number | null;
}

/** Custom pour quote (prototype customQuote, lines 654-661). */
export function customQuote(p: Pour, entry: number, unit: VolumeUnit): CustomQuote {
  const ml = toMl(entry, unit);
  const bk = bucket(p, ml);
  const price = priceAt(p, ml, bk.pct);
  const r = perMl(p);
  const lo = lowPerMl(p);
  return {
    ml,
    ...bk,
    price,
    cost: lo != null ? centsFromDollars(lo * ml) : null,
    pricedCost: r != null ? centsFromDollars(r * ml) : null,
    actual: price != null && price > 0 && r != null ? ((r * ml) / (price / 100)) * 100 : null,
  };
}

export interface StdMatch {
  index: number;
  serving: Serving;
  quote: StdQuote;
}

/**
 * Standard pours a custom volume snaps to (SPEC §5 Snapping; prototype
 * stdMatches, lines 861-863): priced servings whose volume is within
 * max(1 mL, 0.5% of the serving's volume) of the entered volume.
 */
export function stdMatches(p: Pour, ml: number): StdMatch[] {
  return p.servings
    .map((serving, index) => ({ index, serving, quote: stdQuote(p, serving) }))
    .filter(
      (x) =>
        x.quote.price != null &&
        x.quote.price > 0 &&
        Math.abs(x.quote.ml - ml) <= Math.max(1, x.quote.ml * 0.005),
    );
}

/**
 * What a keypad entry rings in as (prototype addCustom, lines 875-884):
 * - exactly one matching standard → it rings as that standard, at the
 *   standard price (the line becomes the standard pour — see Q5);
 * - several matches → the bartender picks one;
 * - no match → a custom line, unless it can't be priced.
 */
export type CustomRingResolution =
  | { kind: 'invalid' }
  | { kind: 'std'; match: StdMatch }
  | { kind: 'pick'; matches: StdMatch[] }
  | { kind: 'custom'; quote: CustomQuote };

export function resolveCustomRing(p: Pour, entry: number, unit: VolumeUnit): CustomRingResolution {
  if (!Number.isFinite(entry) || entry <= 0) return { kind: 'invalid' };
  const quote = customQuote(p, entry, unit);
  const matches = stdMatches(p, quote.ml);
  if (matches.length === 1) return { kind: 'std', match: matches[0]! };
  if (matches.length > 1) return { kind: 'pick', matches };
  if (quote.price == null || quote.price <= 0) return { kind: 'invalid' };
  return { kind: 'custom', quote };
}

/**
 * A menu item's theoretical cost in cents: the recipe's volumes at each
 * product's lowest cost on file (prototype itemCost, line 667).
 */
export function itemCost(item: MenuItem, lookup: (pid: string) => Product | undefined): Cents {
  let dollars = 0;
  for (const r of item.recipe ?? []) {
    const q = lookup(r.pid);
    const pm = q && isPour(q) ? lowPerMl(q) : null;
    if (pm != null) dollars += pm * r.ml;
  }
  return centsFromDollars(dollars);
}
