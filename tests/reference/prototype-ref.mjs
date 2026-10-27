/**
 * Float reference implementation, ported VERBATIM from the prototype
 * (prototype/pour-register.html) — dollars as floats, exactly the formulas
 * Conner signed off button by button. The production engine (integer cents)
 * is verified against this over the whole seed library.
 *
 * Do not "improve" this file: its value is being a faithful copy.
 * Line references: OZ 548, servingMl 630, basisCost 631, perMl 632,
 * lowPerMl 634, perMlFor 635, priceAt 636, bucket 637-642, stdPrice 643-650,
 * customQuote 654-661, stdMatches 861-863, hhPrice 1447-1453.
 */
export const OZ = 29.5735;

export const servingMl = (s) => (s.unit === 'oz' ? s.qty * OZ : s.qty);
export const perMlFor = (p, basis) => {
  const v = p.cost[basis];
  return v && v > 0 ? v / p.size : null;
};
export const basisCost = (p) => {
  const v = p.cost[p.basis];
  return v && v > 0 ? v : null;
};
export const perMl = (p) => {
  const c = basisCost(p);
  return c ? c / p.size : null;
};
export const lowPerMl = (p) => {
  const v = ['frontline', 'net', 'sale'].map((b) => perMlFor(p, b)).filter(Boolean);
  return v.length ? Math.min(...v) : null;
};
export const priceAt = (p, ml, pct) => {
  const r = perMl(p);
  return r && pct > 0 ? Math.round((r * ml) / (pct / 100)) : null;
};
export const bucket = (p, ml) => {
  const step = p.size / 10;
  const b = Math.min(10, Math.max(1, Math.ceil(ml / step - 1e-9)));
  const pct = p.scale.min + ((p.scale.max - p.scale.min) * (b - 1)) / 9;
  return { b, pct, lo: (b - 1) * step, hi: b * step };
};
export const stdPrice = (p, s) => {
  const ml = servingMl(s),
    basis = s.basis || p.basis,
    r = perMlFor(p, basis);
  const over = s.override != null && s.override !== '' && s.override > 0;
  const price = over ? Math.round(s.override) : r && s.target > 0 ? Math.round((r * ml) / (s.target / 100)) : null;
  const actual = price && r ? ((r * ml) / price) * 100 : null;
  const lo = lowPerMl(p);
  return { ml, price, actual, over, basis, cost: lo ? lo * ml : null };
};
export const customQuote = (p, val, unit) => {
  const ml = unit === 'oz' ? val * OZ : val;
  const bk = bucket(p, ml);
  const price = priceAt(p, ml, bk.pct);
  const r = perMl(p);
  const lo = lowPerMl(p);
  return {
    ml,
    ...bk,
    price,
    cost: lo ? lo * ml : null,
    pricedCost: r ? r * ml : null,
    actual: price && r ? ((r * ml) / price) * 100 : null,
  };
};
export const stdMatches = (p, ml) =>
  p.servings
    .map((s, i) => ({ s, i, q: stdPrice(p, s) }))
    .filter((x) => x.q.price && Math.abs(x.q.ml - ml) <= Math.max(1, x.q.ml * 0.005));
export const isItem = (p) => p && p.kind === 'item';
/* value semantics here are the prototype's: dollars for off/price, percent for pct */
export const hhPrice = (rule, price, p) => {
  if (!rule || !(rule.value > 0)) return null;
  if (rule.type === 'off') return Math.max(0, price - rule.value);
  if (rule.type === 'pct') return Math.max(0, Math.round(price * (1 - Math.min(100, rule.value) / 100) * 100) / 100);
  if (rule.type === 'price') return isItem(p) ? rule.value : null;
  return null;
};
export const itemCost = (p, lookup) =>
  (p.recipe || []).reduce((a, r) => {
    const q = lookup(r.pid);
    const pm = q ? lowPerMl(q) : null;
    return a + (pm ? pm * r.ml : 0);
  }, 0);
