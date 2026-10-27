import type { Cents } from './money';
import type { VolumeUnit } from './units';

/** The three container costs a pour can carry (SPEC §4). */
export type CostBasis = 'frontline' | 'net' | 'sale';
export const COST_BASES: readonly CostBasis[] = ['frontline', 'net', 'sale'];

/** Cost per container on each basis, in cents; null when not on file. */
export interface CostSet {
  frontline: Cents | null;
  net: Cents | null;
  sale: Cents | null;
}

/**
 * A serving button (SPEC §4): label, amount, unit, target cost % and basis.
 * `override` is a manual price in cents; when set (> 0) it replaces the
 * derived price. Seed overrides were cleared on purpose (SPEC §5) — the
 * seed loader strips them by default.
 */
export interface Serving {
  label?: string;
  qty: number;
  unit: VolumeUnit;
  /** target cost percentage, e.g. 15 means 15% */
  target: number;
  basis: CostBasis;
  override?: Cents | null;
}

/** Custom-pour sliding scale: cost % slides from min (bucket 1) to max (bucket 10). */
export interface PourScale {
  min: number;
  max: number;
}

/**
 * Happy-hour setting on an item or a menu (SPEC §14).
 * `value` is cents for 'off' and 'price', a percentage for 'pct'.
 * 'inherit' (items only) defers to the menus; 'none' opts out.
 */
export interface HHSetting {
  type: 'inherit' | 'none' | 'off' | 'pct' | 'price';
  value?: number;
}

interface ProductBase {
  id: string;
  name: string;
  /** category tags; a product can be in several (SPEC §4) */
  cats: string[];
  /** the reporting category; always one of cats */
  primary: string | null;
  section?: string;
  allergens?: string[];
  /** item-level happy hour override */
  hh?: HHSetting;
}

/** A pour: priced from container cost, size and serving targets. */
export interface Pour extends ProductBase {
  kind: 'pour';
  /** container size in mL */
  size: number;
  /** units per pack */
  pack: number;
  cost: CostSet;
  /** the default cost basis; also prices custom pours (prototype behavior — see Q4) */
  basis: CostBasis;
  scale: PourScale;
  servings: Serving[];
}

export interface RecipeLine {
  pid: string;
  ml: number;
}

/** A menu item: manually priced, whole dollars; depletes through its recipe. */
export interface MenuItem extends ProductBase {
  kind: 'item';
  /** whole-dollar price in cents */
  price: Cents;
  placeholder?: boolean;
  station?: string;
  recipe: RecipeLine[];
}

export type Product = Pour | MenuItem;

export const isItem = (p: Product): p is MenuItem => p.kind === 'item';
export const isPour = (p: Product): p is Pour => p.kind === 'pour';
