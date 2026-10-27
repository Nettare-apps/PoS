/**
 * Library normalization, ported from the prototype's norm/fixPrimary/normLib
 * (lines 566, 580-581): every serving carries a basis, the primary category
 * is always one of the product's categories, and the category list covers
 * every category a product uses.
 */
import { isPour, type Product } from '../engine/types';
import type { LibraryData } from './types';

export function fixPrimary(p: Product): void {
  if (!p.primary || !p.cats.includes(p.primary)) p.primary = p.cats[0] ?? null;
}

export function normalizeProduct(p: Product): Product {
  if (isPour(p)) {
    for (const s of p.servings) {
      if (!s.basis) s.basis = p.basis;
    }
  }
  fixPrimary(p);
  return p;
}

/** Normalizes in place and returns the same object (prototype normLib, line 566). */
export function normalizeLibrary(lib: LibraryData): LibraryData {
  lib.products.forEach(normalizeProduct);
  for (const p of lib.products) {
    for (const c of p.cats) {
      if (!lib.categories.includes(c)) lib.categories.push(c);
    }
  }
  return lib;
}

export function deepClone<T>(value: T): T {
  return structuredClone(value);
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  const ka = Object.keys(a as object).filter((k) => (a as Record<string, unknown>)[k] !== undefined);
  const kb = Object.keys(b as object).filter((k) => (b as Record<string, unknown>)[k] !== undefined);
  if (ka.length !== kb.length) return false;
  return ka.every((k) =>
    deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}
