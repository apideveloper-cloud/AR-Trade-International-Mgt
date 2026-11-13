// Bangladesh mobile numbers. The same rule runs again on the server, so what is accepted here is accepted there.

/** 01XXXXXXXXX (operators 013 to 019) from 01712-345678, +880 1712 345678, 8801712345678 and the like; '' if the text is not a mobile number. */
export function bdMobile(v) {
  const raw = String(v ?? '');
  if (!raw || /[^\d\s+\-().]/.test(raw)) return '';
  let d = raw.replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('880')) d = '0' + d.slice(3);
  else if (d.length === 10 && d[0] === '1') d = '0' + d;
  return /^01[3-9]\d{8}$/.test(d) ? d : '';
}

/** 01712345678 shown as 01712-345678. */
export const showMobile = n => (n.length === 11 ? n.slice(0, 5) + '-' + n.slice(5) : n);

export const MOBILE_HINT = 'Enter a valid mobile number, e.g. 01712-345678';

/** Live check while typing: '' if the text is fine or still a possible start of a number, otherwise the hint. */
export function mobileProblem(v) {
  const raw = String(v ?? '').trim();
  if (!raw || bdMobile(raw)) return '';
  if (/[^\d\s+\-().]/.test(raw)) return MOBILE_HINT;
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('880') && d.length > 3) d = '0' + d.slice(3);
  const bad = MOBILE_HINT;
  if (d[0] === '0') {
    if (d.length >= 2 && d[1] !== '1') return bad;
    if (d.length >= 3 && !/[3-9]/.test(d[2])) return bad;
    return d.length >= 11 ? bad : '';
  }
  if (d[0] === '1') { // typed without the leading 0
    if (d.length >= 2 && !/[3-9]/.test(d[1])) return bad;
    return d.length >= 10 ? bad : '';
  }
  return '880'.startsWith(d) ? '' : bad; // "8", "88", "880" can still become +880...
}
