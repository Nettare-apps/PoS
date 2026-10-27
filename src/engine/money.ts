/**
 * Money is stored as integer cents everywhere (SPEC §4: "Store money as
 * integer cents in production").
 *
 * Derived *pricing* math (cost-per-mL ÷ target %) intentionally runs in
 * floating-point dollars so it stays bit-for-bit faithful to the prototype's
 * formulas, and converts to cents only at the boundary. Stored amounts —
 * prices, costs, totals, discounts — are always integer cents.
 */

/** Integer cents. A whole-dollar price is a multiple of 100. */
export type Cents = number;

export function centsFromDollars(dollars: number): Cents {
  return Math.round(dollars * 100);
}

export function dollarsFromCents(cents: Cents): number {
  return cents / 100;
}

export function assertCents(value: number): Cents {
  if (!Number.isInteger(value)) throw new Error(`Not integer cents: ${value}`);
  return value;
}

export function isWholeDollars(cents: Cents): boolean {
  return cents % 100 === 0;
}

/**
 * Display rule (SPEC §5 Rounding: "Display cents whenever an amount has
 * them"; prototype `cash`/`money`/`money2`, lines 618-621): whole dollars
 * show no cents, anything else shows two decimals.
 */
export function formatCents(cents: Cents): string {
  const neg = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  if (abs % 100 === 0) return `${neg}$${(abs / 100).toLocaleString('en-US')}`;
  return `${neg}$${(abs / 100).toFixed(2)}`;
}
