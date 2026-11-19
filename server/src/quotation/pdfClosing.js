// PDF sections: the signature block and the footer on every page.
import { DEFAULT_OFFICE } from './constants.js';
import { H, LINE, M, MUTED, NAVY, BLUE, INK, RIGHT, W, put } from '../invoice.js';

/** Closing block: signer (left) and customer acceptance (middle). */
export function drawClosing(doc, q, y) {
  if (y + 78 > H - 64) { doc.addPage(); y = 52; }
  const top2 = y;
  put(doc, 'Best regards,', M, top2, { size: 8.5, color: MUTED });
  const lineY = top2 + 36;
  doc.moveTo(M, lineY).lineTo(M + 175, lineY).lineWidth(0.7).strokeColor(INK).stroke();
  put(doc, String(q.signerName || q.by || '').toUpperCase(), M, lineY + 5, { size: 9.5, bold: true, color: NAVY });
  let sy = lineY + 19;
  for (const [k, v] of [['Desig:', q.signerDesig], ['Dep:', q.signerDept], ['Cell/wa.me:', q.signerCell]]) { if (v) { put(doc, k + ' ' + v, M, sy, { size: 8 }); sy += 10.5; } }
  put(doc, 'For AR Trade International', M, sy + 3, { size: 7.5, color: MUTED });
  const mx = M + 260;
  put(doc, 'Accepted by the customer', mx, top2, { size: 8.5, color: MUTED });
  doc.moveTo(mx, lineY).lineTo(mx + 200, lineY).lineWidth(0.7).strokeColor(INK).stroke();
  put(doc, 'Name, signature, date', mx, lineY + 5, { size: 7.5, color: MUTED });
}

/** Writes the footer (disclaimer, office, contacts) on every buffered page. */
export function drawFooters(doc, site) {
  const foot = () => {
    doc.moveTo(M, H - 62).lineTo(RIGHT, H - 62).lineWidth(0.6).strokeColor(LINE).stroke();
    put(doc, 'Management has the right to change any term or condition at any time without prior notice.', W / 2, H - 55, { size: 7, bold: true, align: 'center', color: BLUE });
    put(doc, `Office: ${site.address || DEFAULT_OFFICE}${site.phone ? '   ·   Phone: ' + site.phone : ''}`, W / 2, H - 44, { size: 7, align: 'center', color: INK });
    put(doc, [site.email ? 'E-mail: ' + site.email : '', 'Website: www.artradeinternational.com'].filter(Boolean).join('   ·   '), W / 2, H - 34, { size: 7, align: 'center', color: MUTED });
  };
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) { doc.switchToPage(range.start + i); foot(); }
}
