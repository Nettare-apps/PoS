/** Volume units. Lines always store volume in mL; oz is an entry/display unit. */

/** The prototype's exact conversion constant (pour-register.html line 548). */
export const OZ_TO_ML = 29.5735;

export type VolumeUnit = 'oz' | 'ml';

export function toMl(qty: number, unit: VolumeUnit): number {
  return unit === 'oz' ? qty * OZ_TO_ML : qty;
}

export function toOz(ml: number): number {
  return ml / OZ_TO_ML;
}
