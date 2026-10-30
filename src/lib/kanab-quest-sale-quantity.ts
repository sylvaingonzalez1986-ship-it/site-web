/** A null selection follows the available maximum; an empty field is invalid. */
export function parseKqSaleQuantity(value: string | null): { valid: boolean; units?: number } {
  if (value === null) return { valid: true };
  if (!value.trim()) return { valid: false };
  const tenths = Number(value.replace(",", ".")) * 10;
  const units = Math.round(tenths);
  if (!Number.isSafeInteger(units) || units <= 0 || Math.abs(tenths - units) > 1e-8) return { valid: false };
  return { valid: true, units };
}
