// GTIN / EAN barcode helpers (pure). Stored digits-only in products.gtin.

/** Strips spaces and hyphens; returns the digits when the length is 8, 12, 13 or 14, else null. */
export function normalizeGtin(s) {
  if (s == null) return null;
  const t = String(s).replace(/[\s-]+/g, '');
  return /^\d+$/.test(t) && [8, 12, 13, 14].includes(t.length) ? t : null;
}

/** True when the value is a well-formed GTIN whose GS1 mod-10 check digit is right. */
export function gtinValid(s) {
  const g = normalizeGtin(s);
  if (!g) return false;
  let sum = 0;
  for (let i = g.length - 2, w = 3; i >= 0; i--, w = 4 - w) sum += (g.charCodeAt(i) - 48) * w;
  return (10 - (sum % 10)) % 10 === g.charCodeAt(g.length - 1) - 48;
}
