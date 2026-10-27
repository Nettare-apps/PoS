import type { Cents } from '../engine/money';
import type { VolumeUnit } from '../engine/units';
import type { HHConfig } from '../engine/happyHour';
import type { Product } from '../engine/types';

/** A modifier-group item; `link` depletes a product when chosen (SPEC §4). */
export interface ModGroupItem {
  id: string;
  name: string;
  /** upcharge in cents */
  price: Cents;
  link: { pid: string; ml: number } | null;
}

export interface ModGroup {
  id: string;
  /** Seats and Course are built-in groups (SPEC §7) */
  kind?: 'seat' | 'course';
  name: string;
  multi: boolean;
  /** alert groups (allergens) flag the KDS */
  alert?: boolean;
  items: ModGroupItem[];
}

/** required = must answer; force = shown automatically, can be skipped; optional. */
export type ModRule = 'required' | 'force' | 'optional';

export interface ModAssignment {
  gid: string;
  rule: ModRule;
}

export interface ModsConfig {
  groups: ModGroup[];
  /** group assignments per menu (category) */
  menus: Record<string, ModAssignment[]>;
  /** per-item setup; inherit:false replaces the menu-derived groups */
  items: Record<string, { inherit: false; groups: ModAssignment[] }>;
}

export interface LibrarySettings {
  /** the ring-in unit (SPEC §5 Units) */
  unit: VolumeUnit;
  /** category → parent category */
  parents: Record<string, string>;
  hh: HHConfig;
}

/** Everything the library publishes as one unit. */
export interface LibraryData {
  products: Product[];
  categories: string[];
  settings: LibrarySettings;
  mods: ModsConfig;
}
