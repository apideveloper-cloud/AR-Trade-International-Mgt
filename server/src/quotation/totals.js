// Pure number and date helpers: amount in words, totals, display formats.

/** Amount in words, Bangladeshi style (lakh, crore): 7500 -> "SEVEN THOUSAND FIVE HUNDRED". */
export function words(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (!n) return 'ZERO';
  const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
  const below100 = x => (x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : ''));
  const below1000 = x => (x >= 100 ? ones[Math.floor(x / 100)] + ' HUNDRED' + (x % 100 ? ' ' + below100(x % 100) : '') : below100(x));
  const parts = [];
  for (const [div, name] of [[10000000, 'CRORE'], [100000, 'LAKH'], [1000, 'THOUSAND']]) {
    const q = Math.floor(n / div);
    if (q) { parts.push((q >= 100 && div === 10000000 ? words(q) : below1000(q)) + ' ' + name); n %= div; }
  }
  if (n) parts.push(below1000(n));
  return parts.join(' ');
}

/** Total of the lines and the net payable: total + installation + transport + VAT - discount, never below 0. */
export const totalsOf = (lines, b) => {
  const total = lines.reduce((t, l) => t + l.qty * l.unitPrice, 0);
  return { total, net: Math.max(0, total + b.install + b.transport + b.vat - b.discount) };
};

/** 1234.4 -> "1,234.00" (whole taka with a .00 tail, as the printed quotation shows it). */
export const num = n => Math.round(Number(n) || 0).toLocaleString('en-US') + '.00';
/** "2026-03-09" -> "09/03/2026". */
export const dmy = d => { const [y, m, dd] = String(d).split('-'); return `${dd}/${m}/${y}`; };
/** Last day the quotation is valid, as dd/mm/yyyy: the quotation date plus its valid days. */
export const validUntil = (date, validDays) => { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + (validDays || 0)); return dmy(d.toISOString().slice(0, 10)); };
/** "SEVEN THOUSAND" -> "Seven Thousand". */
export const titleCase = s => s.toLowerCase().replace(/(^| )([a-z])/g, (_, a, b) => a + b.toUpperCase());
/** An ALL CAPS paragraph -> sentence case ("HELLO. WORLD" -> "Hello. World"). */
export const sentence = s => { const t = String(s || '').trim(); return t ? t.toLowerCase().replace(/(^|[.!?]\s+)([a-z])/g, (_, a, b) => a + b.toUpperCase()) : ''; };
