/**
 * Happy hour (SPEC §14). Pure functions over the published library's
 * settings; time is passed in explicitly so the engine stays deterministic.
 *
 * Production pins Chicago time; callers convert a wall-clock Date to a
 * LocalTime with localTimeOf.
 */
import { type Cents } from './money';
import { isItem, type HHSetting, type Product } from './types';

/** "HH:MM" start/end per weekday (0 = Sunday), as the library stores it. */
export type HHSchedule = Partial<Record<0 | 1 | 2 | 3 | 4 | 5 | 6, [string, string]>>;

export interface HHConfig {
  schedule: HHSchedule;
  /** per-menu (category) pricing rules; absence of a category = no rule */
  menus: Record<string, HHSetting>;
}

/** The seed schedule (SPEC §14 table; prototype HH_DEFAULT, line 1424). */
export const HH_DEFAULT_SCHEDULE: HHSchedule = {
  0: ['17:00', '21:00'],
  4: ['16:00', '18:00'],
  5: ['16:00', '17:30'],
  6: ['16:00', '17:30'],
};

/** A moment in local wall-clock terms: weekday + milliseconds since midnight. */
export interface LocalTime {
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  ms: number;
}

export function localTimeOf(d: Date): LocalTime {
  return {
    day: d.getDay() as LocalTime['day'],
    ms: ((d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds()) * 1000 + d.getMilliseconds(),
  };
}

function hmToMs(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return ((h ?? 0) * 60 + (m ?? 0)) * 60000;
}

/**
 * The day's window in ms since midnight, or null when the day has no happy
 * hour (prototype hhWindow, lines 1430-1434).
 *
 * TODO(Q7): windows cannot cross midnight — an end before the start is never
 * active, matching the prototype. Nettare's business day runs to 5 am, so
 * this is an open question for Conner.
 */
export function hhWindow(schedule: HHSchedule, day: LocalTime['day']): { startMs: number; endMs: number } | null {
  const sch = schedule[day];
  if (!sch || !sch[0] || !sch[1]) return null;
  return { startMs: hmToMs(sch[0]), endMs: hmToMs(sch[1]) };
}

export interface HHStatus {
  active: boolean;
  /** within 5 minutes of the window's end, before or after (SPEC §14) */
  near: boolean;
  /** ms until the window ends; negative after the end; 0 when no window */
  leftMs: number;
  startMs?: number;
  endMs?: number;
}

/** Where "now" stands against the window (prototype hhNow, lines 1435-1436). */
export function hhStatus(schedule: HHSchedule, t: LocalTime): HHStatus {
  const w = hhWindow(schedule, t.day);
  if (!w) return { active: false, near: false, leftMs: 0 };
  const active = t.ms >= w.startMs && t.ms < w.endMs;
  const near = Math.abs(t.ms - w.endMs) <= 5 * 60000 && t.ms >= w.startMs;
  return { active, near, leftMs: w.endMs - t.ms, startMs: w.startMs, endMs: w.endMs };
}

/** A resolved rule: what applies to a product and where it came from. */
export interface HHRule {
  type: 'off' | 'pct' | 'price';
  /** cents for 'off'/'price'; percentage for 'pct' */
  value: number;
  /** 'item' or the category the rule came from */
  from: string;
}

/**
 * Rule precedence (SPEC §14; prototype hhRule, lines 1438-1446):
 * item rule, then primary menu, then other menus, then their parent menus.
 * An item can opt out ('none'). Note: a category with no rule of its own
 * falls through to its parent — only items can opt out (SPEC gap, flagged).
 */
export function hhRule(
  menus: Record<string, HHSetting>,
  parents: Record<string, string>,
  p: Product,
): HHRule | null {
  const own = p.hh;
  if (own && own.type && own.type !== 'inherit') {
    return own.type === 'none' ? null : { type: own.type, value: own.value ?? 0, from: 'item' };
  }
  const order = [p.primary, ...p.cats].filter((c): c is string => !!c);
  // Prototype parity (tryC, line 1442): a menu rule with any type other than
  // 'none' STOPS the search — 'none' (or no rule) falls through to the next
  // menu and then the parents. A stored type that isn't priceable (e.g. a
  // stray 'inherit') therefore stops the search and yields no discount,
  // exactly as the prototype prices it.
  const tryCat = (c: string): HHRule | 'stop' | null => {
    const r = menus[c];
    if (!r || !r.type || r.type === 'none') return null;
    if (r.type === 'off' || r.type === 'pct' || r.type === 'price') {
      return { type: r.type, value: r.value ?? 0, from: c };
    }
    return 'stop';
  };
  for (const c of order) {
    const r = tryCat(c);
    if (r === 'stop') return null;
    if (r) return r;
  }
  for (const c of order) {
    const par = parents[c];
    if (par) {
      const r = tryCat(par);
      if (r === 'stop') return null;
      if (r) return r;
    }
  }
  return null;
}

/**
 * The happy-hour price for a base price (prototype hhPrice, lines 1447-1453).
 * - '$ off': base minus the value, floored at zero — exact cents.
 * - '% off': exact to the cent (SPEC §5/§14) — same rounding as the prototype.
 * - 'price': a set price, menu items only; null for pours.
 * Returns null when the rule doesn't apply.
 */
export function hhPrice(rule: HHRule | null, priceCents: Cents, isMenuItem: boolean): Cents | null {
  if (!rule || !(rule.value > 0)) return null;
  if (rule.type === 'off') return Math.max(0, priceCents - rule.value);
  if (rule.type === 'pct') {
    // Bit-faithful to the prototype (line 1450): dollars × (1 − pct/100), rounded to the cent.
    const dollars = priceCents / 100;
    return Math.max(0, Math.round(dollars * (1 - Math.min(100, rule.value) / 100) * 100));
  }
  if (rule.type === 'price') return isMenuItem ? rule.value : null;
  return null;
}

/** What a ring-in should carry (mirrors prototype hhPriceLine, lines 1457-1466, without line mutation). */
export interface HHQuote {
  /** the price to ring now, in cents */
  price: Cents;
  /** set when happy-hour pricing was applied */
  hh?: { type: HHRule['type']; value: number; from: string };
  /**
   * The base price whenever a rule *would* change it, in or out of the
   * window — the prototype sets basePrice the same way (line 1463); the
   * reliable in-window marker is `inWindow`, not `base` (SPEC §15 hhWindow).
   */
  base?: Cents;
  /** true when the ring happened inside the window (logged as hhWindow) */
  inWindow: boolean;
  /** within 5 minutes of the end: both prices for the "Happy hour or Regular" prompt */
  ask?: { hhPrice: Cents; basePrice: Cents; leftMs: number };
}

/**
 * Price a ring-in under happy hour: applies the rule inside the window,
 * and asks within 5 minutes of the window's end, before or after (SPEC §14).
 * Happy hour changes the base price only — modifier upcharges are added on
 * top by check math, never discounted (SPEC §14).
 */
export function hhApply(
  cfg: HHConfig,
  parents: Record<string, string>,
  p: Product,
  basePriceCents: Cents,
  t: LocalTime,
): HHQuote {
  const st = hhStatus(cfg.schedule, t);
  const inWindow = st.active;
  const rule = hhRule(cfg.menus, parents, p);
  if (!rule) return { price: basePriceCents, inWindow };
  const hp = hhPrice(rule, basePriceCents, isItem(p));
  if (hp == null || hp === basePriceCents) return { price: basePriceCents, inWindow };
  return {
    price: st.active ? hp : basePriceCents,
    hh: st.active ? { type: rule.type, value: rule.value, from: rule.from } : undefined,
    base: basePriceCents,
    inWindow,
    ask: st.near ? { hhPrice: hp, basePrice: basePriceCents, leftMs: st.leftMs } : undefined,
  };
}
