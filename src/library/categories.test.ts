import { describe, expect, it } from 'vitest';
import {
  addCategory,
  catNameError,
  deleteCategory,
  inCategory,
  orderedCategories,
  renameCategory,
  setParent,
} from './categories';
import { seedLibrary } from './seed';
import type { LibraryData } from './types';

const lib = (): LibraryData => seedLibrary();

describe('category operations (SPEC §7)', () => {
  it('validates names: empty, "All", duplicates (case-insensitive)', () => {
    const l = lib();
    expect(catNameError(l, '')).toContain('Enter');
    expect(catNameError(l, 'all')).toContain('reserved');
    expect(catNameError(l, 'whisky')).toContain('exists');
    expect(catNameError(l, 'Whisky', 'Whisky')).toBe('');
    expect(catNameError(l, 'Zero Proof')).toBe('');
  });

  it('rename cascades into tags, primaries, parents (both sides), modifier menus and HH menus', () => {
    const l = lib();
    l.settings.hh.menus['Whisky'] = { type: 'pct', value: 10 };
    expect(renameCategory(l, 'Whisky', 'Brown Spirits')).toBe('');
    expect(l.categories).toContain('Brown Spirits');
    expect(l.categories).not.toContain('Whisky');
    const bankNote = l.products.find((p) => p.name === 'Bank Note 5yr Peated')!;
    expect(bankNote.cats).toContain('Brown Spirits');
    expect(bankNote.primary).toBe('Brown Spirits');
    expect(l.settings.parents['Brown Spirits']).toBe('Spirits');
    expect(l.settings.hh.menus['Brown Spirits']).toEqual({ type: 'pct', value: 10 });
    expect(l.settings.hh.menus['Whisky']).toBeUndefined();
    // renaming a parent updates the children's mapping values
    expect(renameCategory(l, 'Spirits', 'Hard Stuff')).toBe('');
    expect(l.settings.parents['Brown Spirits']).toBe('Hard Stuff');
    // modifier menu assignments moved with it
    expect(l.mods.menus['Hard Stuff']).toBeDefined();
    expect(l.mods.menus['Spirits']).toBeUndefined();
  });

  it('delete removes the tag everywhere and re-fixes primaries', () => {
    const l = lib();
    const whiskies = l.products.filter((p) => p.primary === 'Whisky');
    expect(whiskies.length).toBeGreaterThan(0);
    deleteCategory(l, 'Whisky');
    expect(l.categories).not.toContain('Whisky');
    for (const p of l.products) {
      expect(p.cats).not.toContain('Whisky');
      if (p.primary) expect(p.cats).toContain(p.primary);
    }
    expect(l.settings.parents['Whisky']).toBeUndefined();
    // deleting a parent unlinks its children
    deleteCategory(l, 'Food');
    expect(Object.values(l.settings.parents)).not.toContain('Food');
  });

  it('add and setParent', () => {
    const l = lib();
    expect(addCategory(l, 'Zero Proof')).toBe('');
    expect(l.categories).toContain('Zero Proof');
    setParent(l, 'Zero Proof', 'Non-Alc');
    expect(l.settings.parents['Zero Proof']).toBe('Non-Alc');
    setParent(l, 'Zero Proof', null);
    expect(l.settings.parents['Zero Proof']).toBeUndefined();
  });

  it('inCategory sees children through the parent; orderedCategories nests children after parents', () => {
    const l = lib();
    const bankNote = l.products.find((p) => p.name === 'Bank Note 5yr Peated')!;
    expect(inCategory(l.settings.parents, bankNote, 'Spirits')).toBe(true);
    expect(inCategory(l.settings.parents, bankNote, 'Food')).toBe(false);
    const ordered = orderedCategories(l.categories, l.settings.parents);
    expect(ordered).toHaveLength(l.categories.length);
    expect(ordered.indexOf('Whisky')).toBe(ordered.indexOf('Spirits') + 1);
  });
});
