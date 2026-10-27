/**
 * Seed loader tests against data/pos_data.json (SPEC §18, data/README.md):
 * 377 products = 256 pours + 121 menu items, 18 seed categories (+3 parents
 * added at load), 65 placeholder prices, overrides stripped by default.
 */
import { describe, expect, it } from 'vitest';
import { isItem, isPour, OZ_TO_ML } from '../engine';
import type { Pour } from '../engine/types';
import { HH_DEFAULT_SCHEDULE } from '../engine/happyHour';
import { seedInventory, seedLibrary, seedParents } from './seed';

describe('seedLibrary', () => {
  const lib = seedLibrary();
  const pours = lib.products.filter(isPour);
  const items = lib.products.filter(isItem);

  it('loads 376 products: 256 pours and 120 menu items (Lunch Burger consolidated, 2026-10-27)', () => {
    expect(lib.products).toHaveLength(376);
    expect(pours).toHaveLength(256);
    expect(items).toHaveLength(120);
  });

  it('has one Burger, on both menus, with the lunch price as a modifier (Conner, 2026-10-27)', () => {
    const burgers = items.filter((i) => i.name === 'Burger');
    expect(burgers).toHaveLength(1);
    const burger = burgers[0]!;
    expect(burger.price).toBe(1800);
    expect(burger.cats).toEqual(['Dinner', 'Lunch']);
    expect(burger.primary).toBe('Dinner');
    const menu = lib.mods.groups.find((g) => g.id === 'burgermenu')!;
    expect(menu.multi).toBe(false);
    expect(menu.items.map((i) => ({ name: i.name, price: i.price }))).toEqual([
      { name: 'Dinner', price: 0 },
      { name: 'Lunch', price: 400 },
    ]);
    expect(lib.mods.items[burger.id]!.groups).toContainEqual({ gid: 'burgermenu', rule: 'force' });
    // Steak Au Poivre keeps its setup without the menu group
    const steak = items.find((i) => i.name === 'Steak Au Poivre')!;
    expect(lib.mods.items[steak.id]!.groups.some((g) => g.gid === 'burgermenu')).toBe(false);
    expect(lib.mods.items[steak.id]!.groups).toContainEqual({ gid: 'temp', rule: 'required' });
  });

  it('65 menu items carry placeholder prices (SPEC §17)', () => {
    expect(items.filter((i) => i.placeholder).length).toBe(65);
  });

  it('adds the three parent categories ahead of their first child (18 + 3 = 21)', () => {
    expect(lib.categories).toHaveLength(21);
    for (const parent of ['Spirits', 'Modifiers', 'Food']) expect(lib.categories).toContain(parent);
    expect(lib.categories.indexOf('Spirits')).toBeLessThan(lib.categories.indexOf('Whisky'));
    expect(lib.categories.indexOf('Food')).toBeLessThan(lib.categories.indexOf('Dinner'));
    expect(Object.keys(lib.settings.parents)).toHaveLength(13);
    expect(lib.settings.parents['Cheese & Charcuterie']).toBe('Food');
    expect(seedParents()['Whisky']).toBe('Spirits');
  });

  it('strips serving price overrides by default — pours price from target until go-live (SPEC §5)', () => {
    const withOverrides = seedLibrary({ stripOverrides: false });
    const count = (ps: Pour[]) => ps.flatMap((p) => p.servings).filter((s) => s.override != null).length;
    expect(count(pours)).toBe(0);
    expect(count(withOverrides.products.filter(isPour))).toBeGreaterThan(700);
    const bankNote = withOverrides.products.find((p) => p.name === 'Bank Note 5yr Peated') as Pour;
    expect(bankNote.servings[0]!.override).toBe(900);
  });

  it('stores all money as integer cents', () => {
    for (const p of pours) {
      for (const v of Object.values(p.cost)) if (v != null) expect(Number.isInteger(v)).toBe(true);
    }
    for (const i of items) expect(Number.isInteger(i.price)).toBe(true);
    const bankNote = pours.find((p) => p.name === 'Bank Note 5yr Peated')!;
    expect(bankNote.cost.frontline).toBe(2170);
  });

  it('base menu prices are whole dollars (SPEC §5 Rounding)', () => {
    for (const i of items) expect(i.price % 100, `${i.id} ${i.name}`).toBe(0);
  });

  it('every pour has sane pricing inputs (size, scale, servings, targets)', () => {
    // The golden sweep compares two implementations over the same JSON, so it
    // would agree on corrupt data — this guards the data itself.
    for (const p of pours) {
      expect(p.size, `${p.id} size`).toBeGreaterThan(0);
      expect(p.scale.min, `${p.id} scale`).toBeGreaterThan(0);
      expect(p.scale.max, `${p.id} scale`).toBeGreaterThanOrEqual(p.scale.min);
      expect(p.servings.length, `${p.id} servings`).toBeGreaterThan(0);
      for (const s of p.servings) {
        expect(s.qty, `${p.id} serving qty`).toBeGreaterThan(0);
        expect(s.target, `${p.id} serving target`).toBeGreaterThan(0);
      }
      const costs = Object.values(p.cost).filter((c): c is number => c != null);
      expect(costs.length, `${p.id} has a cost on file`).toBeGreaterThan(0);
    }
  });

  it('every serving has a basis and every primary is one of the product’s categories', () => {
    for (const p of pours) for (const s of p.servings) expect(s.basis).toBeTruthy();
    for (const p of lib.products) if (p.primary) expect(p.cats).toContain(p.primary);
  });

  it('seeds the happy-hour schedule with no menu rules yet (SPEC §14)', () => {
    expect(lib.settings.hh.schedule).toEqual(HH_DEFAULT_SCHEDULE);
    expect(lib.settings.hh.menus).toEqual({});
    expect(lib.settings.unit).toBe('oz');
  });

  it('seeds the starter modifier groups and assignments (prototype seedMods)', () => {
    const ids = lib.mods.groups.map((g) => g.id);
    expect(ids).toEqual(['seat', 'course', 'general', 'cocktail', 'allergen', 'milk', 'temp', 'burgermenu', 'tinct']);
    const cocktail = lib.mods.groups.find((g) => g.id === 'cocktail')!;
    expect(cocktail.items[0]).toMatchObject({ name: 'Old Fashioned', price: 400 });
    const tinct = lib.mods.groups.find((g) => g.id === 'tinct')!;
    expect(tinct.items[0]!.link).toEqual({ pid: 'pb239', ml: OZ_TO_ML });
    expect(lib.mods.groups.find((g) => g.id === 'allergen')!.alert).toBe(true);
    expect(lib.mods.menus['Cocktails']![0]).toEqual({ gid: 'seat', rule: 'force' });
    // Burger and Steak Au Poivre carry their own setup with required temperature
    const burger = lib.products.find((p) => p.name === 'Burger')!;
    expect(lib.mods.items[burger.id]).toMatchObject({ inherit: false });
    expect(lib.mods.items[burger.id]!.groups).toContainEqual({ gid: 'temp', rule: 'required' });
  });
});

describe('seedInventory', () => {
  it('has a starting count per pour (test values)', () => {
    const inv = seedInventory();
    expect(Object.keys(inv)).toHaveLength(256);
    for (const v of Object.values(inv)) expect(typeof v).toBe('number');
  });
});
