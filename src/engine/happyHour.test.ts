/**
 * Happy hour tests (SPEC §14). Anchors confirmed on the live prototype:
 * 20% off Cocktails prices a $16 Spritz at $12.80; the end-of-window prompt
 * fires within 5 minutes of the end, before and after.
 */
import { describe, expect, it } from 'vitest';
import {
  HH_DEFAULT_SCHEDULE,
  hhApply,
  hhPrice,
  hhRule,
  hhStatus,
  localTimeOf,
  type HHConfig,
  type LocalTime,
} from './happyHour';
import type { MenuItem, Pour } from './types';

const at = (day: LocalTime['day'], h: number, m: number, s = 0, ms = 0): LocalTime => ({
  day,
  ms: ((h * 60 + m) * 60 + s) * 1000 + ms,
});

const spritz: MenuItem = {
  kind: 'item',
  id: 'mi1',
  name: 'Spritz',
  cats: ['Cocktails'],
  primary: 'Cocktails',
  price: 1600,
  recipe: [],
};

const whisky: Pour = {
  kind: 'pour',
  id: 'p1',
  name: 'Whisky',
  cats: ['Whisky'],
  primary: 'Whisky',
  size: 750,
  pack: 1,
  cost: { frontline: 2170, net: null, sale: null },
  basis: 'frontline',
  scale: { min: 15, max: 25 },
  servings: [],
};

describe('hhStatus (the schedule window)', () => {
  const sch = HH_DEFAULT_SCHEDULE; // Thu 16:00–18:00, Fri/Sat 16:00–17:30, Sun 17:00–21:00
  it('is active inside the window, inclusive start, exclusive end', () => {
    expect(hhStatus(sch, at(4, 15, 59)).active).toBe(false);
    expect(hhStatus(sch, at(4, 16, 0)).active).toBe(true);
    expect(hhStatus(sch, at(4, 17, 59, 59)).active).toBe(true);
    expect(hhStatus(sch, at(4, 18, 0)).active).toBe(false);
  });
  it('is near within 5 minutes of the end, before or after — never before the start', () => {
    expect(hhStatus(sch, at(4, 17, 54, 59)).near).toBe(false);
    expect(hhStatus(sch, at(4, 17, 55)).near).toBe(true);
    expect(hhStatus(sch, at(4, 18, 0)).near).toBe(true);
    expect(hhStatus(sch, at(4, 18, 5)).near).toBe(true);
    expect(hhStatus(sch, at(4, 18, 5, 0, 1)).near).toBe(false);
    // Sunday 17:00–21:00: 16:58 is 2 min before a 4-hour window's start
    expect(hhStatus(sch, at(0, 16, 58)).near).toBe(false);
  });
  it('days without a window are never active', () => {
    expect(hhStatus(sch, at(1, 17, 0))).toMatchObject({ active: false, near: false });
  });
  it('matches the SPEC §14 table', () => {
    expect(hhStatus(sch, at(5, 17, 29)).active).toBe(true); // Fri to 17:30
    expect(hhStatus(sch, at(5, 17, 30)).active).toBe(false);
    expect(hhStatus(sch, at(0, 20, 59)).active).toBe(true); // Sun to 21:00
  });
  it('localTimeOf converts a wall-clock Date', () => {
    const t = localTimeOf(new Date(2026, 9, 29, 17, 55, 30)); // a Thursday
    expect(t.day).toBe(4);
    expect(t.ms).toBe(((17 * 60 + 55) * 60 + 30) * 1000);
  });
});

describe('hhRule (precedence: item, primary menu, other menus, parent menus)', () => {
  const parents = { Whisky: 'Spirits', Cocktails: 'Drinks' };
  it('finds a parent-menu rule when nothing closer applies', () => {
    expect(hhRule({ Spirits: { type: 'pct', value: 10 } }, parents, whisky)).toMatchObject({
      type: 'pct',
      value: 10,
      from: 'Spirits',
    });
  });
  it('a direct menu rule beats the parent', () => {
    const menus = { Whisky: { type: 'pct' as const, value: 15 }, Spirits: { type: 'pct' as const, value: 10 } };
    expect(hhRule(menus, parents, whisky)?.from).toBe('Whisky');
  });
  it('the primary menu beats other menus', () => {
    const p = { ...whisky, cats: ['A', 'B'], primary: 'B' };
    const menus = { A: { type: 'pct' as const, value: 10 }, B: { type: 'pct' as const, value: 20 } };
    expect(hhRule(menus, {}, p)?.from).toBe('B');
  });
  it('an item rule wins over everything; "none" opts the item out', () => {
    const menus = { Cocktails: { type: 'pct' as const, value: 20 } };
    expect(hhRule(menus, {}, { ...spritz, hh: { type: 'off', value: 300 } })).toMatchObject({
      type: 'off',
      value: 300,
      from: 'item',
    });
    expect(hhRule(menus, {}, { ...spritz, hh: { type: 'none' } })).toBeNull();
    expect(hhRule(menus, {}, { ...spritz, hh: { type: 'inherit' } })?.from).toBe('Cocktails');
  });
  it('returns null with no applicable rule', () => {
    expect(hhRule({}, parents, whisky)).toBeNull();
  });
  it('a menu rule of "none" falls through to the parent, like a missing rule', () => {
    const menus = { Whisky: { type: 'none' as const }, Spirits: { type: 'pct' as const, value: 10 } };
    expect(hhRule(menus, parents, whisky)?.from).toBe('Spirits');
  });
  it('other menus beat parent menus (SPEC §14 precedence)', () => {
    const p = { ...whisky, cats: ['Whisky', 'Staff Picks'], primary: 'Whisky' };
    const menus = {
      'Staff Picks': { type: 'pct' as const, value: 10 },
      Spirits: { type: 'pct' as const, value: 20 },
    };
    expect(hhRule(menus, parents, p)?.from).toBe('Staff Picks');
  });
  it('a stored menu rule the engine cannot price stops the search with no discount (prototype parity)', () => {
    // The library UI never stores 'inherit' on a menu, but the prototype's
    // tryC stops on any non-'none' type and then prices nothing — so must we.
    const menus = {
      Whisky: { type: 'inherit' as const },
      Spirits: { type: 'pct' as const, value: 10 },
    };
    expect(hhRule(menus, parents, whisky)).toBeNull();
  });
});

describe('hhPrice', () => {
  it('% off is exact to the cent: 20% off $16 is $12.80', () => {
    expect(hhPrice({ type: 'pct', value: 20, from: 'Cocktails' }, 1600, true)).toBe(1280);
    expect(hhPrice({ type: 'pct', value: 20, from: 'x' }, 1500, true)).toBe(1200);
    expect(hhPrice({ type: 'pct', value: 15, from: 'x' }, 1300, true)).toBe(1105);
  });
  it('$ off floors at zero', () => {
    expect(hhPrice({ type: 'off', value: 200, from: 'x' }, 400, false)).toBe(200);
    expect(hhPrice({ type: 'off', value: 500, from: 'x' }, 400, false)).toBe(0);
  });
  it('a set price applies to menu items only (SPEC §14)', () => {
    expect(hhPrice({ type: 'price', value: 900, from: 'x' }, 1600, true)).toBe(900);
    expect(hhPrice({ type: 'price', value: 900, from: 'x' }, 1600, false)).toBeNull();
  });
  it('requires a positive value; % is capped at 100', () => {
    expect(hhPrice({ type: 'pct', value: 0, from: 'x' }, 1600, true)).toBeNull();
    expect(hhPrice(null, 1600, true)).toBeNull();
    expect(hhPrice({ type: 'pct', value: 120, from: 'x' }, 1600, true)).toBe(0);
  });
});

describe('hhApply (ring-in pricing)', () => {
  const cfg: HHConfig = {
    schedule: HH_DEFAULT_SCHEDULE,
    menus: { Cocktails: { type: 'pct', value: 20 } },
  };
  it('applies the rule inside the window', () => {
    const q = hhApply(cfg, {}, spritz, 1600, at(4, 17, 0));
    expect(q).toMatchObject({ price: 1280, inWindow: true, base: 1600 });
    expect(q.hh).toMatchObject({ type: 'pct', value: 20, from: 'Cocktails' });
    expect(q.ask).toBeUndefined();
  });
  it('asks within 5 minutes before the end (already priced at happy hour)', () => {
    const q = hhApply(cfg, {}, spritz, 1600, at(4, 17, 57));
    expect(q.price).toBe(1280);
    expect(q.ask).toMatchObject({ hhPrice: 1280, basePrice: 1600 });
    expect(q.ask!.leftMs).toBe(3 * 60000);
  });
  it('asks within 5 minutes after the end (priced regular until answered)', () => {
    const q = hhApply(cfg, {}, spritz, 1600, at(4, 18, 3));
    expect(q.price).toBe(1600);
    expect(q.hh).toBeUndefined();
    expect(q.inWindow).toBe(false);
    expect(q.ask).toMatchObject({ hhPrice: 1280, basePrice: 1600 });
  });
  it('outside the window: regular price, but base is still reported when a rule would apply (prototype parity)', () => {
    const q = hhApply(cfg, {}, spritz, 1600, at(2, 17, 0));
    expect(q).toMatchObject({ price: 1600, inWindow: false, base: 1600 });
    expect(q.hh).toBeUndefined();
    expect(q.ask).toBeUndefined();
  });
  it('no rule: just the base price', () => {
    const q = hhApply(cfg, {}, whisky, 600, at(4, 17, 0));
    expect(q).toMatchObject({ price: 600, inWindow: true });
    expect(q.base).toBeUndefined();
  });
  it('a rule that does not change the price is ignored', () => {
    const cfg2: HHConfig = { schedule: HH_DEFAULT_SCHEDULE, menus: { Cocktails: { type: 'off', value: 0 } } };
    const q = hhApply(cfg2, {}, spritz, 1600, at(4, 17, 0));
    expect(q.base).toBeUndefined();
    expect(q.price).toBe(1600);
  });
});
