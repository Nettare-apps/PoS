import { describe, expect, it } from 'vitest';
import { centsFromDollars, formatCents, isWholeDollars } from './money';

describe('money', () => {
  it('converts seed dollars to integer cents', () => {
    expect(centsFromDollars(21.7)).toBe(2170);
    expect(centsFromDollars(0.1 + 0.2)).toBe(30);
  });
  it('shows cents only when an amount has them (SPEC §5)', () => {
    expect(formatCents(600)).toBe('$6');
    expect(formatCents(1440)).toBe('$14.40');
    expect(formatCents(0)).toBe('$0');
    expect(formatCents(123400)).toBe('$1,234');
    expect(formatCents(-250)).toBe('-$2.50');
  });
  it('whole-dollar check', () => {
    expect(isWholeDollars(600)).toBe(true);
    expect(isWholeDollars(1280)).toBe(false);
  });
});
