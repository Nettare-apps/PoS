/**
 * Builds the initial library from data/pos_data.json — the 2026-10-26
 * snapshot of the Price Book, Menu Guide and Recipe Book (377 products:
 * 256 pours + 121 menu items, 18 categories, test counts).
 *
 * Ports the prototype's load-time seeding (norm line 581, seedParents 2111,
 * seedMods 2126-2148, migrateLib 2149-2170):
 * - dollar amounts in the JSON become integer cents;
 * - serving overrides are STRIPPED by default — they were cleared on purpose
 *   (SPEC §5): pours price from their target cost % until the menu is
 *   reconciled at go-live;
 * - parent categories (Spirits, Modifiers, Food) are added to the category
 *   list ahead of their first child;
 * - the starter modifier groups/assignments and the happy-hour schedule are
 *   seeded in code (they are not in the JSON — data/README.md).
 */
import raw from '../../data/pos_data.json';
import { centsFromDollars, type Cents } from '../engine/money';
import { OZ_TO_ML, type VolumeUnit } from '../engine/units';
import { HH_DEFAULT_SCHEDULE } from '../engine/happyHour';
import type { CostBasis, MenuItem, Pour, Product, Serving } from '../engine/types';
import { normalizeLibrary } from './normalize';
import type { LibraryData, ModAssignment, ModGroup, ModsConfig } from './types';

interface RawServing {
  label?: string;
  qty: number;
  unit: string;
  target: number;
  override?: number | null;
  basis?: string;
}
interface RawProduct {
  id: string;
  kind?: string;
  name: string;
  cats?: string[];
  cat?: string;
  primary?: string | null;
  section?: string;
  size?: number;
  pack?: number;
  cost?: { frontline?: number | null; net?: number | null; sale?: number | null } | null;
  basis?: string;
  scale?: { min: number; max: number };
  servings?: RawServing[];
  allergens?: string[];
  price?: number;
  placeholder?: boolean;
  station?: string;
  recipe?: { pid: string; ml: number }[];
}
interface RawData {
  products: RawProduct[];
  categories: string[];
  inv: Record<string, number>;
}

const data = raw as unknown as RawData;

export interface SeedOptions {
  /** strip serving price overrides, as the prototype does at load (default true) */
  stripOverrides?: boolean;
}

function toCents(dollars: number | null | undefined): Cents | null {
  return dollars == null ? null : centsFromDollars(dollars);
}

function seedServing(s: RawServing, productBasis: CostBasis, strip: boolean): Serving {
  const override =
    !strip && s.override != null && s.override !== ('' as unknown) && s.override > 0
      ? centsFromDollars(s.override)
      : undefined;
  return {
    ...(s.label != null ? { label: s.label } : {}),
    qty: s.qty,
    unit: (s.unit === 'oz' ? 'oz' : 'ml') as VolumeUnit,
    target: s.target,
    basis: (s.basis as CostBasis) || productBasis,
    ...(override != null ? { override } : {}),
  };
}

function seedProduct(p: RawProduct, strip: boolean): Product {
  const cats = Array.isArray(p.cats) ? p.cats.slice() : p.cat ? [p.cat] : [];
  const base = {
    id: p.id,
    name: p.name,
    cats,
    primary: p.primary ?? null,
    ...(p.section != null ? { section: p.section } : {}),
    ...(p.allergens != null ? { allergens: p.allergens.slice() } : {}),
  };
  if (p.kind === 'item') {
    const item: MenuItem = {
      ...base,
      kind: 'item',
      price: centsFromDollars(p.price ?? 0),
      ...(p.placeholder != null ? { placeholder: p.placeholder } : {}),
      ...(p.station != null ? { station: p.station } : {}),
      recipe: (p.recipe ?? []).map((r) => ({ pid: r.pid, ml: r.ml })),
    };
    return item;
  }
  const basis = (p.basis as CostBasis) || 'frontline';
  const pour: Pour = {
    ...base,
    kind: 'pour',
    size: p.size ?? 0,
    pack: p.pack ?? 1,
    cost: {
      frontline: toCents(p.cost?.frontline),
      net: toCents(p.cost?.net),
      sale: toCents(p.cost?.sale),
    },
    basis,
    scale: { min: p.scale?.min ?? 0, max: p.scale?.max ?? 0 },
    servings: (p.servings ?? []).map((s) => seedServing(s, basis, strip)),
  };
  return pour;
}

/** Category → parent map (prototype seedParents, lines 2111-2115). */
export function seedParents(): Record<string, string> {
  return {
    Whisky: 'Spirits',
    'Gin & Vodka': 'Spirits',
    'Brandy & Absinthe': 'Spirits',
    'Cane & Agave': 'Spirits',
    'Amaro & Aperitivo': 'Spirits',
    Liqueur: 'Spirits',
    'Tonics & Tinctures': 'Modifiers',
    'Bitters & Syrups': 'Modifiers',
    Dinner: 'Food',
    Lunch: 'Food',
    Dessert: 'Food',
    Pastries: 'Food',
    'Cheese & Charcuterie': 'Food',
  };
}

function seatGroup(): ModGroup {
  return { id: 'seat', kind: 'seat', name: 'Seats', multi: true, items: [] };
}

function courseGroup(): ModGroup {
  return {
    id: 'course',
    kind: 'course',
    name: 'Course',
    multi: false,
    items: ['Drinks', 'Course 1', 'Course 2', 'Course 3', 'Dessert'].map((n, i) => ({
      id: 'c' + i,
      name: n,
      price: 0,
      link: null,
    })),
  };
}

/** Starter modifier groups and menu assignments (prototype seedMods, lines 2126-2148). */
export function seedMods(products: Product[]): ModsConfig {
  const byName = (n: string) => products.find((p) => p.name === n)?.id;
  type ItemSpec = [string, number?, { pid: string; ml: number }?];
  const g = (
    id: string,
    name: string,
    multi: boolean,
    items: ItemSpec[],
    extra: Partial<ModGroup> = {},
  ): ModGroup => ({
    id,
    name,
    multi,
    items: items.map((x, i) => ({
      id: `${id}-${i}`,
      name: x[0],
      price: centsFromDollars(x[1] ?? 0),
      link: x[2] ?? null,
    })),
    ...extra,
  });
  const groups: ModGroup[] = [
    seatGroup(),
    courseGroup(),
    g('general', 'General', true, [['No make'], ['To go'], ['Rush'], ['On the side'], ['Light'], ['Extra']]),
    g('cocktail', 'Cocktail styles', false, [
      ['Old Fashioned', 4],
      ['Manhattan', 4],
      ['Martini', 3],
      ['Negroni', 5],
      ['Cosmo', 4],
      ['Sour', 3],
      ['Mule', 3],
      ['Highball', 2],
    ]),
    g(
      'allergen',
      'Allergens',
      true,
      [['Milk'], ['Eggs'], ['Fish'], ['Shellfish'], ['Tree nuts'], ['Peanuts'], ['Wheat'], ['Soy'], ['Sesame']],
      { alert: true },
    ),
    g('milk', 'Milk', false, [['Whole'], ['Oat', 1], ['Skim'], ['Half & half'], ['No milk']]),
    g('temp', 'Temperature', false, [['Rare'], ['Medium rare'], ['Medium'], ['Medium well'], ['Well']]),
    g('tinct', 'Tonics & Tinctures', true, [
      ['Aplos Arise 1 oz', 9, { pid: 'pb239', ml: OZ_TO_ML }],
      ['Aplos Calme 1 oz', 9, { pid: 'pb240', ml: OZ_TO_ML }],
      ['Aplos Ease 1 oz', 9, { pid: 'pb238', ml: OZ_TO_ML }],
    ]),
  ];
  const a = (gid: string, rule: ModAssignment['rule'] = 'optional'): ModAssignment => ({ gid, rule });
  const menus: Record<string, ModAssignment[]> = {
    Spirits: [a('seat'), a('course'), a('general'), a('cocktail')],
    Wine: [a('seat'), a('course'), a('general')],
    'Beer & Canned': [a('seat'), a('course'), a('general')],
    'Non-Alc': [a('seat'), a('course'), a('general'), a('tinct')],
    Cocktails: [a('seat', 'force'), a('course'), a('general'), a('allergen'), a('tinct')],
    'Cafe Drinks': [a('seat'), a('course'), a('milk', 'force'), a('general'), a('allergen')],
    Food: [a('seat', 'force'), a('course', 'force'), a('general'), a('allergen')],
    'Cheese & Charcuterie': [a('seat', 'force'), a('course', 'force'), a('general'), a('allergen')],
  };
  const items: ModsConfig['items'] = {};
  for (const n of ['Burger', 'Steak Au Poivre']) {
    const id = byName(n);
    if (id) {
      items[id] = {
        inherit: false,
        groups: [a('seat', 'required'), a('course', 'force'), a('temp', 'required'), a('general'), a('allergen')],
      };
    }
  }
  return { groups, menus, items };
}

/**
 * Insert the parent categories into the list, each ahead of its first child
 * (prototype migrateLib, lines 2151-2155).
 */
function withParentCategories(categories: string[], parents: Record<string, string>): string[] {
  const cats = categories.slice();
  for (const parent of ['Spirits', 'Modifiers', 'Food']) {
    if (cats.includes(parent) || !Object.values(parents).includes(parent)) continue;
    const first = cats.findIndex((c) => parents[c] === parent);
    cats.splice(first < 0 ? cats.length : first, 0, parent);
  }
  return cats;
}

/** The library as the prototype boots it: seed data + code-seeded settings and mods. */
export function seedLibrary(options: SeedOptions = {}): LibraryData {
  const strip = options.stripOverrides ?? true;
  const products = data.products.map((p) => seedProduct(p, strip));
  // Prototype order: normLib first appends any category a product uses that
  // the list is missing (line 566), THEN migrateLib derives parents from and
  // inserts parent categories into that augmented list (lines 2151-2155).
  const baseCategories = data.categories.slice();
  for (const p of products) {
    for (const c of p.cats) if (!baseCategories.includes(c)) baseCategories.push(c);
  }
  const parents: Record<string, string> = {};
  for (const [c, parent] of Object.entries(seedParents())) {
    if (baseCategories.includes(c)) parents[c] = parent;
  }
  const categories = withParentCategories(baseCategories, parents);
  const lib: LibraryData = {
    products,
    categories,
    settings: {
      unit: 'oz',
      parents,
      hh: { schedule: structuredClone(HH_DEFAULT_SCHEDULE), menus: {} },
    },
    mods: seedMods(products),
  };
  return normalizeLibrary(lib);
}

/** Starting bottle counts per pour — test values, not a real count (data/README.md). */
export function seedInventory(): Record<string, number> {
  return { ...data.inv };
}
