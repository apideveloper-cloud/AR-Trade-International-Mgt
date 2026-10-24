// Sales-order document (PDF) for the field app's sales orders. Same look as the invoice; the drawing helpers come from invoice.js.
import fs from 'node:fs';
import PDFDocument from 'pdfkit';
import { FONT_FILES, H, LINE, M, MUTED, NAVY, BLUE, INK, RIGHT, SOFT, drawHeader, measure, money, put, qrPng, when, wrap } from './invoice.js';

/** Builds the PDF for sales order `o` (the shape of /api/field/orders/:id, plus approvedBy) and resolves to the bytes. */
export async function buildSalesOrderPdf(o, site = {}) {
  const qr = await qrPng(`AR TRADE | SALES ORDER | ${o.id} | ${Math.round(o.total)} BDT`);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true, info: { Title: `${o.id} - Sales order - AR Trade International`, Author: 'AR Trade International' } });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    for (const [k, f] of Object.entries(FONT_FILES)) doc.registerFont(k, f);

    const ci = o.customerInfo || {};
    const tone = { Approved: ['#1f8a4c', '#e6f6ec', 'APPROVED'], Pending: ['#a86400', '#fff3dc', 'WAITING FOR APPROVAL'], Rejected: ['#b3261e', '#fde8e6', 'REJECTED'] }[o.approval] || ['#6b7388', '#eef1f6', String(o.approval || '').toUpperCase()];

    drawHeader(doc, { title: 'SALES ORDER', number: o.id, date: when(o.createdAt), site, qr, caption: 'Order reference' });

    // ---- customer / order details ----
    const colW = (RIGHT - M - 14) / 2;
    const left = [{ t: o.customer || 'Customer', bold: true, size: 11.5 }];
    if (ci.contact) left.push({ t: ci.contact, size: 9.5 });
    if (ci.phone) left.push({ t: ci.phone, size: 9.5 });
    for (const l of wrap(doc, [ci.address, ci.area].filter(Boolean).join(', '), colW - 24, 9.5, false)) left.push({ t: l, size: 9.5, color: MUTED });
    const right = [['Order no.', o.id], ['Order date', when(o.createdAt, false)], ['Taken by', o.by || ''], ['Approval', o.approval === 'Pending' ? 'Waiting' : o.approval || ''], ['Order status', o.status || ''], ['Posted to accounts', o.synced ? 'Yes' : 'No']];
    const boxTop = 120, boxH = Math.max(34 + left.length * 14, 34 + right.length * 14) + 6;
    doc.roundedRect(M, boxTop, colW, boxH, 10).fillAndStroke(SOFT, LINE);
    doc.roundedRect(M + colW + 14, boxTop, colW, boxH, 10).fillAndStroke(SOFT, LINE);
    put(doc, 'CUSTOMER', M + 12, boxTop + 11, { size: 7.5, bold: true, color: BLUE });
    left.forEach((l, i) => put(doc, l.t, M + 12, boxTop + 27 + i * 14, { size: l.size, bold: l.bold, color: l.color || INK }));
    const rx = M + colW + 14 + 12;
    put(doc, 'ORDER DETAILS', rx, boxTop + 11, { size: 7.5, bold: true, color: BLUE });
    right.forEach(([k, v], i) => {
      put(doc, k, rx, boxTop + 27 + i * 14, { size: 9, color: MUTED });
      put(doc, v, rx + colW - 24, boxTop + 27 + i * 14, { size: 9.5, bold: true, align: 'right', color: k === 'Approval' ? tone[0] : INK });
    });

    // ---- items ----
    const X = { sl: M + 10, item: M + 40, qty: M + 340, unit: M + 425, amt: RIGHT - 10 };
    let y = boxTop + boxH + 18;
    const head = () => {
      doc.roundedRect(M, y, RIGHT - M, 24, 7).fill(NAVY);
      [['SL', X.sl, 'left'], ['ITEM', X.item, 'left'], ['QTY', X.qty, 'right'], ['UNIT PRICE', X.unit, 'right'], ['AMOUNT', X.amt, 'right']].forEach(([t, x, a]) => put(doc, t, x, y + 8, { size: 8, bold: true, color: '#ffffff', align: a }));
      y += 28;
    };
    head();
    (o.lines || []).forEach((it, i) => {
      const lines = wrap(doc, it.name, 262, 9.5, false);
      const sku = it.sku ? 'SKU ' + it.sku : '';
      const rowH = (lines.length + (sku ? 1 : 0)) * 13 + 12;
      if (y + rowH > H - 150) { doc.addPage(); y = 40; head(); }
      if (i % 2 === 0) doc.rect(M, y - 2, RIGHT - M, rowH).fill('#f8fafd');
      put(doc, String(i + 1), X.sl, y + 5, { size: 9, color: MUTED });
      lines.forEach((l, k) => put(doc, l, X.item, y + 5 + k * 13, { size: 9.5 }));
      if (sku) put(doc, sku, X.item, y + 5 + lines.length * 13, { size: 8, color: MUTED });
      put(doc, String(it.qty), X.qty, y + 5, { size: 9.5, align: 'right' });
      put(doc, money(it.price), X.unit, y + 5, { size: 9.5, align: 'right' });
      put(doc, money(it.price * it.qty), X.amt, y + 5, { size: 9.5, bold: true, align: 'right' });
      doc.moveTo(M, y + rowH - 2).lineTo(RIGHT, y + rowH - 2).lineWidth(0.5).strokeColor(LINE).stroke();
      y += rowH;
    });

    // ---- totals, approval stamp and note ----
    if (y + 190 > H - 90) { doc.addPage(); y = 40; }
    y += 14;
    const bx = M + 285, bw = RIGHT - bx;
    [['Subtotal', money(o.subtotal)], ['Order discount', o.discount ? '− ' + money(o.discount) : money(0)]].forEach(([k, v], i) => {
      put(doc, k, bx + 12, y + i * 17, { size: 9.5, color: MUTED });
      put(doc, v, RIGHT - 12, y + i * 17, { size: 9.5, align: 'right' });
    });
    const ty = y + 2 * 17 + 4;
    doc.roundedRect(bx, ty, bw, 32, 8).fill('#e4eefb');
    put(doc, 'TOTAL', bx + 12, ty + 11, { size: 9, bold: true, color: NAVY });
    put(doc, money(o.total), RIGHT - 12, ty + 8, { size: 15, bold: true, color: NAVY, align: 'right' });
    const stampW = Math.max(120, measure(doc, tone[2], 9.5, true) + 28);
    doc.roundedRect(M, y - 3, stampW, 24, 12).fill(tone[1]);
    put(doc, tone[2], M + stampW / 2, y + 4, { size: 9.5, bold: true, color: tone[0], align: 'center' });
    let ny = y + 30;
    if (o.approvedBy) { put(doc, (o.approval === 'Rejected' ? 'Rejected by ' : 'Approved by ') + o.approvedBy, M, ny, { size: 9, color: MUTED }); ny += 16; }
    if (o.notes) {
      put(doc, 'NOTE', M, ny, { size: 7.5, bold: true, color: BLUE });
      for (const l of wrap(doc, o.notes, 250, 9, false).slice(0, 4)) { ny += 12; put(doc, l, M, ny, { size: 9 }); }
    }

    // ---- signatures ----
    const sy = Math.max(ty + 70, ny + 40);
    if (sy + 40 < H - 80) {
      doc.moveTo(M, sy).lineTo(M + 190, sy).lineWidth(0.6).strokeColor(MUTED).stroke();
      put(doc, 'Prepared by' + (o.by ? ': ' + o.by : ''), M, sy + 5, { size: 8.5, color: MUTED });
      doc.moveTo(RIGHT - 190, sy).lineTo(RIGHT, sy).lineWidth(0.6).strokeColor(MUTED).stroke();
      put(doc, 'Customer signature and date', RIGHT - 190, sy + 5, { size: 8.5, color: MUTED });
    }

    // ---- footer on every page ----
    const foot = () => {
      doc.moveTo(M, H - 66).lineTo(RIGHT, H - 66).lineWidth(0.6).strokeColor(LINE).stroke();
      put(doc, 'AR Trade International', M, H - 56, { size: 9.5, bold: true, color: NAVY });
      put(doc, [site.address || '159 Santinagar, Dhaka-1217', site.phone, site.email].filter(Boolean).join('   ·   '), M, H - 42, { size: 8, color: MUTED });
      put(doc, 'Sales order at the shop price list of the order date. This is not a tax invoice; the invoice is issued on delivery.', M, H - 30, { size: 8, color: MUTED });
    };
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) { doc.switchToPage(range.start + i); foot(); }
    doc.end();
  });
}

/** The delivery note: what goes to the customer, ticked off item by item, with the proof that was taken. */
export async function buildDeliveryNotePdf(d, site = {}) {
  const qr = await qrPng(`AR TRADE | DELIVERY NOTE | ${d.id} | ${d.orderId}`);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true, info: { Title: `${d.id} - Delivery note - AR Trade International`, Author: 'AR Trade International' } });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    for (const [k, f] of Object.entries(FONT_FILES)) doc.registerFont(k, f);
    const done = d.status === 'Delivered';
    const tone = done ? ['#1f8a4c', '#e6f6ec', 'DELIVERED'] : d.status === 'OnTheWay' ? ['#6a45d6', '#eee9fd', 'ON THE WAY'] : ['#a86400', '#fff3dc', 'READY TO DELIVER'];

    drawHeader(doc, { title: 'DELIVERY NOTE', number: d.id, date: when(d.deliveredAt || new Date()), site, qr, caption: 'Delivery reference' });

    const colW = (RIGHT - M - 14) / 2;
    const left = [{ t: d.customer || 'Customer', bold: true, size: 11.5 }];
    if (d.contact) left.push({ t: d.contact, size: 9.5 });
    if (d.phone) left.push({ t: d.phone, size: 9.5 });
    for (const l of wrap(doc, d.address || '', colW - 24, 9.5, false)) left.push({ t: l, size: 9.5, color: MUTED });
    const right = [['Delivery no.', d.id], ['Sales order', d.orderId], ['Status', done ? 'Delivered' : d.status === 'OnTheWay' ? 'On the way' : 'Ready'], [done ? 'Delivered at' : 'ETA', done ? when(d.deliveredAt) : d.eta || ''], ['Received by', d.receivedBy || ''], ['Payment terms', d.terms || ''], ['Invoice', d.invoiceId || 'on delivery']];
    const boxTop = 120, boxH = Math.max(34 + left.length * 14, 34 + right.length * 14) + 6;
    doc.roundedRect(M, boxTop, colW, boxH, 10).fillAndStroke(SOFT, LINE);
    doc.roundedRect(M + colW + 14, boxTop, colW, boxH, 10).fillAndStroke(SOFT, LINE);
    put(doc, 'DELIVER TO', M + 12, boxTop + 11, { size: 7.5, bold: true, color: BLUE });
    left.forEach((l, i) => put(doc, l.t, M + 12, boxTop + 27 + i * 14, { size: l.size, bold: l.bold, color: l.color || INK }));
    const rx = M + colW + 14 + 12;
    put(doc, 'DELIVERY DETAILS', rx, boxTop + 11, { size: 7.5, bold: true, color: BLUE });
    right.forEach(([k, v], i) => { put(doc, k, rx, boxTop + 27 + i * 14, { size: 9, color: MUTED }); put(doc, v, rx + colW - 24, boxTop + 27 + i * 14, { size: 9.5, bold: true, align: 'right' }); });

    const X = { sl: M + 10, item: M + 40, qty: M + 400, chk: RIGHT - 18 };
    let y = boxTop + boxH + 18;
    const head = () => {
      doc.roundedRect(M, y, RIGHT - M, 24, 7).fill(NAVY);
      [['SL', X.sl, 'left'], ['ITEM', X.item, 'left'], ['QTY', X.qty, 'right'], ['CHECKED', X.chk, 'right']].forEach(([t, x, a]) => put(doc, t, x, y + 8, { size: 8, bold: true, color: '#ffffff', align: a }));
      y += 28;
    };
    head();
    (d.lines || []).forEach((it, i) => {
      const lines = wrap(doc, it.name, 320, 9.5, false);
      const sku = it.sku ? 'SKU ' + it.sku : '';
      const rowH = (lines.length + (sku ? 1 : 0)) * 13 + 12;
      if (y + rowH > H - 150) { doc.addPage(); y = 40; head(); }
      if (i % 2 === 0) doc.rect(M, y - 2, RIGHT - M, rowH).fill('#f8fafd');
      put(doc, String(i + 1), X.sl, y + 5, { size: 9, color: MUTED });
      lines.forEach((l, k) => put(doc, l, X.item, y + 5 + k * 13, { size: 9.5 }));
      if (sku) put(doc, sku, X.item, y + 5 + lines.length * 13, { size: 8, color: MUTED });
      put(doc, String(it.qty), X.qty, y + 5, { size: 10, bold: true, align: 'right' });
      doc.roundedRect(RIGHT - 28, y + 3, 14, 14, 3).lineWidth(0.8).strokeColor(MUTED).stroke();
      if (done) { doc.moveTo(RIGHT - 25, y + 10).lineTo(RIGHT - 22, y + 14).lineTo(RIGHT - 16, y + 6).lineWidth(1.6).strokeColor('#1f8a4c').stroke(); }
      doc.moveTo(M, y + rowH - 2).lineTo(RIGHT, y + rowH - 2).lineWidth(0.5).strokeColor(LINE).stroke();
      y += rowH;
    });

    if (y + 190 > H - 90) { doc.addPage(); y = 40; }
    y += 14;
    const bx = M + 285, bw = RIGHT - bx;
    const pieces = (d.lines || []).reduce((t, l) => t + l.qty, 0);
    [['Items', String((d.lines || []).length)], ['Total pieces', String(pieces)]].forEach(([k, v], i) => { put(doc, k, bx + 12, y + i * 17, { size: 9.5, color: MUTED }); put(doc, v, RIGHT - 12, y + i * 17, { size: 9.5, align: 'right' }); });
    const ty = y + 2 * 17 + 4;
    doc.roundedRect(bx, ty, bw, 32, 8).fill('#e4eefb');
    put(doc, 'ORDER VALUE', bx + 12, ty + 11, { size: 9, bold: true, color: NAVY });
    put(doc, money(d.amount), RIGHT - 12, ty + 8, { size: 15, bold: true, color: NAVY, align: 'right' });
    const stampW = Math.max(130, measure(doc, tone[2], 9.5, true) + 28);
    doc.roundedRect(M, y - 3, stampW, 24, 12).fill(tone[1]);
    put(doc, tone[2], M + stampW / 2, y + 4, { size: 9.5, bold: true, color: tone[0], align: 'center' });
    let ny = y + 30;
    for (const [ok, label] of [[d.hasPhoto, 'Delivery photo'], [d.hasSignature, 'Customer signature'], [d.otpOk, 'OTP verified'], [d.gps, 'Location recorded']]) {
      put(doc, (ok ? '✓ ' : '– ') + label, M, ny, { size: 9, color: ok ? '#1f8a4c' : MUTED }); ny += 13;
    }

    const sy = Math.max(ty + 70, ny + 34);
    if (sy + 40 < H - 80) {
      doc.moveTo(M, sy).lineTo(M + 190, sy).lineWidth(0.6).strokeColor(MUTED).stroke();
      put(doc, 'Delivered by (AR Trade)', M, sy + 5, { size: 8.5, color: MUTED });
      doc.moveTo(RIGHT - 190, sy).lineTo(RIGHT, sy).lineWidth(0.6).strokeColor(MUTED).stroke();
      put(doc, 'Received by (name, signature, date)', RIGHT - 190, sy + 5, { size: 8.5, color: MUTED });
    }
    const foot = () => {
      doc.moveTo(M, H - 66).lineTo(RIGHT, H - 66).lineWidth(0.6).strokeColor(LINE).stroke();
      put(doc, 'AR Trade International', M, H - 56, { size: 9.5, bold: true, color: NAVY });
      put(doc, [site.address || '159 Santinagar, Dhaka-1217', site.phone, site.email].filter(Boolean).join('   ·   '), M, H - 42, { size: 8, color: MUTED });
      put(doc, 'Please check the items against this note before signing. The invoice follows on delivery.', M, H - 30, { size: 8, color: MUTED });
    };
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) { doc.switchToPage(range.start + i); foot(); }
    doc.end();
  });
}
