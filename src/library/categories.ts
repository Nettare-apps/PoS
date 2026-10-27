/**
 * Category operations on a library working copy (SPEC §7 Categories), ported
 * from the prototype's renameCat/deleteCat/catNameErr (lines 591-612) and the
 * parent helpers (2116-2119). All functions mutate the passed LibraryData —
 * callers hand in their working copy; nothing here touches the draft or the
 * published library.
 */
import { fixPrimary } from './normalize';
import type { LibraryData } from './types';

/** Why a proposed category name is not allowed, or '' when it is fine. */
export function catNameError(lib: LibraryData, name: string, except?: string): string {
  const n = name.trim();
  if (!n) return 'Enter a name for the category.';
  if (n.toLowerCase() === 'all') return '"All" is reserved for the full list.';
  if (lib.categories.some((c) => c !== except && c.toLowerCase() === n.toLowerCase())) {
    return `"${n}" already exists.`;
  }
  return '';
}

export function addCategory(lib: LibraryData, name: string): string {
  const err = catNameError(lib, name);
  if (err) return err;
  lib.categories.push(name.trim());
  return '';
}

/** Rename everywhere: products' tags and primaries, the parents map (both sides), menu assignments. */
export function renameCategory(lib: LibraryData, from: string, to: string): string {
  const err = catNameError(lib, to, from);
  if (err) return err;
  const name = to.trim();
  lib.categories = lib.categories.map((c) => (c === from ? name : c));
  for (const p of lib.products) {
    p.cats = p.cats.map((c) => (c === from ? name : c));
    if (p.primary === from) p.primary = name;
  }
  const parents: Record<string, string> = {};
  for (const [c, par] of Object.entries(lib.settings.parents)) {
    parents[c === from ? name : c] = par === from ? name : par;
  }
  lib.settings.parents = parents;
  if (lib.mods.menus[from]) {
    lib.mods.menus[name] = lib.mods.menus[from]!;
    delete lib.mods.menus[from];
  }
  const hhMenus = lib.settings.hh.menus;
  if (hhMenus[from]) {
    hhMenus[name] = hhMenus[from]!;
    delete hhMenus[from];
  }
  return '';
}

/** Delete everywhere; products keep their other tags and primaries are re-fixed. */
export function deleteCategory(lib: LibraryData, cat: string): void {
  lib.categories = lib.categories.filter((c) => c !== cat);
  for (const p of lib.products) {
    p.cats = p.cats.filter((c) => c !== cat);
    fixPrimary(p);
  }
  delete lib.settings.parents[cat];
  for (const [c, par] of Object.entries(lib.settings.parents)) {
    if (par === cat) delete lib.settings.parents[c];
  }
  delete lib.mods.menus[cat];
  delete lib.settings.hh.menus[cat];
}

export function setParent(lib: LibraryData, cat: string, parent: string | null): void {
  if (!parent) delete lib.settings.parents[cat];
  else if (parent !== cat) lib.settings.parents[cat] = parent;
}

export const childrenOf = (parents: Record<string, string>, cat: string): string[] =>
  Object.keys(parents).filter((k) => parents[k] === cat);

/** A product sits in a category directly or through one of its children (prototype inCat, 2119). */
export function inCategory(
  parents: Record<string, string>,
  p: { cats: string[] },
  cat: string,
): boolean {
  return p.cats.includes(cat) || childrenOf(parents, cat).some((k) => p.cats.includes(k));
}

/** Categories ordered as the prototype lists them: each top level followed by its children (line 1491). */
export function orderedCategories(categories: string[], parents: Record<string, string>): string[] {
  return categories
    .filter((c) => !parents[c])
    .flatMap((c) => [c, ...categories.filter((k) => parents[k] === c)]);
}
