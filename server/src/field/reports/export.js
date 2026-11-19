// GET /export?name=sales|collection|delivery|attendance|route|leave|expense|approvals|ledger&period=&format=json|csv
import { Router } from 'express';
import { guard, wrap } from '../common.js';
import { period, CSV } from '../report_util.js';
import { pageOf, wantsPage } from '../../listing.js';
import { kind, customWindow } from './shared.js';
import { dataset } from './datasets.js';

const router = Router();

/** Keeps the rows that contain the text (case-insensitive, first 80 characters of the search). */
export function filterRows(rows, q) {
  const w = String(q || '').trim().toLowerCase().slice(0, 80);
  return w ? rows.filter(r => r.join(' ').toLowerCase().includes(w)) : rows;
}

router.get('/export', guard(), wrap(async (req, res) => {
  const win = customWindow(req) || period(kind(req.query.period || 'month'));
  const data = await dataset(String(req.query.name || ''), win, req);
  // optional (web console): ?q= keeps the rows that contain the text; ?page= &size= returns one page of them in `rows` plus `total` (rows after q)
  data.rows = filterRows(data.rows, req.query.q);
  const total = data.rows.length;
  if (wantsPage(req)) { const pg = pageOf(req, { def: 25, max: 200 }); data.rows = data.rows.slice(pg.offset, pg.offset + pg.size); }
  const out = { ...data, period: win.label, generated: new Date().toISOString(), ...(wantsPage(req) ? { total } : {}) };
  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${data.title.replace(/\W+/g, '_')}.csv"`);
    return res.send('﻿' + CSV([data.columns, ...data.rows]));
  }
  res.json(out);
}));

export default router;
