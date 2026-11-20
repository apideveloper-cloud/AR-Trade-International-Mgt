// Bulk price and stock editing: planning (pure, unit-tested), the paged list, one-transaction apply and the CSV export / preview.
import { pool } from '../db.js';
import { tx } from '../util.js';
import { like } from '../adminHelpers.js';
import { buildCsv, cellOf, parseChecked } from '../admin/seoCsv.js';
import { dateText, dhakaToday, onlyChanged, validatePriceChange } from './priceRules.js';

export const MAX_CHANGES = 500;
export const CSV_COLUMNS = ['id', 'sku', 'name', 'price', 'old_price', 'sale_ends', 'stock', 'stock_status'];
export const ISSUES = ['no_sku', 'sale_expired', 'zero_price', 'out_of_stock', 'low_stock', 'no_stock_status'];
const FIELDS = ['price', 'old', 'saleEnds', 'stock', 'stockStatus'];
const COLS = { price: 'price', old: 'old_price', saleEnds: 'sale_ends', stock: 'stock', stockStatus: 'stock_status' };
const D = c => `DATE_FORMAT(${c}, '%Y-%m-%d')`;
const SELECT = `id, sku, name, brand, category_id, part, price, old_price, ${D('sale_ends')} AS sale_ends, stock, stock_status, active`;

const SELECT_P = `p.id, p.sku, p.name, p.brand, p.category_id, p.part, p.price, p.old_price, ${D('p.sale_ends')} AS sale_ends, p.stock, p.stock_status, p.active`;
/** A stored products row in the shape validatePriceChange and the plans use. */
export const productOf = r => ({ id: r.id, sku: r.sku || '', name: r.name || '', brand: r.brand || '', cat: r.category_id, price: r.price, old: r.old_price || 0, saleEnds: dateText(r.sale_ends), stock: r.stock, stockStatus: r.stock_status || 'auto', active: !!r.active });

/** Plans one product's change: only fields that differ are kept and checked. @returns {{ changes, value, errors:string[], jump }} */
export function planOne(product, request) {
  const diff = onlyChanged(product, request);
  const { value, errors, jump } = validatePriceChange(product, diff);
  const changes = {};
  for (const k of FIELDS) if (k in value) changes[k] = { from: k === 'saleEnds' ? product.saleEnds ?? null : product[k], to: value[k] };
  return { changes, value, errors: errors.map(e => ({ field: e.field, message: e.message })), jump };
}

/**
 * changes = [{ id, price?, old?, saleEnds?, stock?, stockStatus? }], products = Map(id -> product).
 * @returns {{ errors:{id,field,message}[], jumps:{id,name,from,to,pct}[], updates:{id,value}[] }}
 */
export function planBulk(changes, products) {
  const errors = [], jumps = [], updates = [], seen = new Set();
  if (!Array.isArray(changes) || !changes.length) return { errors: [{ id: null, field: 'changes', message: 'Send at least one change' }], jumps, updates };
  if (changes.length > MAX_CHANGES) return { errors: [{ id: null, field: 'changes', message: `At most ${MAX_CHANGES} changes per request` }], jumps, updates };
  for (const c of changes) {
    const id = Number.parseInt(c?.id, 10);
    if (!Number.isInteger(id) || id <= 0) { errors.push({ id: c?.id ?? null, field: 'id', message: 'Product id is missing' }); continue; }
    const p = products.get(id);
    if (!p) { errors.push({ id, field: 'id', message: 'Product not found' }); continue; }
    if (seen.has(id)) { errors.push({ id, field: 'id', message: 'The same product appears twice' }); continue; }
    seen.add(id);
    const plan = planOne(p, c);
    for (const e of plan.errors) errors.push({ id, ...e });
    if (plan.errors.length) continue;
    if (plan.jump) jumps.push({ id, name: p.name, ...plan.jump });
    if (Object.keys(plan.value).length) updates.push({ id, value: plan.value });
  }
  return { errors, jumps, updates };
}

/** Writes the updates in ONE transaction (all or nothing). `run` can be replaced in tests. Returns the number of products updated. */
export async function applyUpdates(updates, run = tx) {
  if (!updates.length) return 0;
  await run(async conn => {
    for (const u of updates) {
      const sets = [], vals = [];
      for (const k of FIELDS) if (k in u.value) { sets.push(`${COLS[k]} = ?`); vals.push(u.value[k]); }
      sets.push('edited = 1');
      await conn.query(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, [...vals, u.id]);
    }
  });
  return updates.length;
}

export async function loadProducts(ids = null) {
  const [rows] = ids ? await pool.query(`SELECT ${SELECT} FROM products WHERE id IN (?)`, [ids]) : await pool.query(`SELECT ${SELECT} FROM products ORDER BY id`);
  return new Map(rows.map(r => [r.id, productOf(r)]));
}

// ---------- paged list ----------
const ISSUE_SQL = {
  no_sku: "(p.sku IS NULL OR p.sku = '')", sale_expired: 'p.sale_ends IS NOT NULL AND p.sale_ends < ?', zero_price: 'p.price = 0',
  out_of_stock: 'p.stock <= 0', low_stock: 'p.stock BETWEEN 1 AND 3', no_stock_status: "(p.stock_status IS NULL OR p.stock_status IN ('', 'auto'))"
};
export async function listPrices(q = {}) {
  const today = dhakaToday(), limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 15)), page = Math.max(1, parseInt(q.page, 10) || 1);
  const cond = [], args = [];
  const s = String(q.q || '').trim().slice(0, 80);
  if (s) { const l = like(s); cond.push('(p.id = ? OR p.sku LIKE ? OR p.name LIKE ? OR p.part LIKE ?)'); args.push(/^\d+$/.test(s) ? Number(s) : 0, l, l, l); }
  if (q.cat) { cond.push('p.category_id = ?'); args.push(String(q.cat)); }
  if (q.brand) { cond.push('p.brand = ?'); args.push(String(q.brand)); }
  if (ISSUE_SQL[q.issue]) { cond.push(ISSUE_SQL[q.issue]); if (q.issue === 'sale_expired') args.push(today); }
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const [[{ n }]] = await pool.query(`SELECT COUNT(*) AS n FROM products p ${where}`, args);
  const pages = Math.max(1, Math.ceil(n / limit));
  const [rows] = await pool.query(`SELECT ${SELECT_P} FROM products p ${where} ORDER BY p.id LIMIT ? OFFSET ?`, [...args, limit, (Math.min(page, pages) - 1) * limit]);
  const [[c]] = await pool.query(`SELECT COALESCE(SUM(sku IS NULL OR sku = ''), 0) AS no_sku, COALESCE(SUM(sale_ends IS NOT NULL AND sale_ends < ?), 0) AS sale_expired, COALESCE(SUM(price = 0), 0) AS zero_price,
    COALESCE(SUM(stock <= 0), 0) AS out_of_stock, COALESCE(SUM(stock BETWEEN 1 AND 3), 0) AS low_stock FROM products`, [today]);
  return {
    rows: rows.map(r => { const p = productOf(r); return { id: p.id, sku: p.sku, name: p.name, brand: p.brand, cat: p.cat, price: p.price, old: p.old, saleEnds: p.saleEnds || '', stock: p.stock, stockStatus: p.stockStatus, active: p.active }; }),
    total: n, page: Math.min(page, pages), pages,
    counts: { no_sku: Number(c.no_sku), sale_expired: Number(c.sale_expired), zero_price: Number(c.zero_price), out_of_stock: Number(c.out_of_stock), low_stock: Number(c.low_stock) }
  };
}

// ---------- CSV ----------
export async function exportCsv() {
  const products = [...(await loadProducts()).values()];
  return '﻿' + buildCsv(products.map(p => ({ id: p.id, sku: p.sku, name: p.name, price: p.price, old_price: p.old, sale_ends: p.saleEnds || '', stock: p.stock, stock_status: p.stockStatus })), CSV_COLUMNS);
}

const ALIASES = { price: ['price'], old: ['old_price', 'old', 'oldprice'], saleEnds: ['sale_ends', 'saleends'], stock: ['stock'], stockStatus: ['stock_status', 'stockstatus'] };
const num = v => v.replace(/[\s,]/g, '').replace(/^৳/, '');

/** What one CSV record asks for: { id, sku, line, request } where blank cells are left out (the words none / clear empty the sale end date). */
function requestOf(record, header) {
  const request = {};
  for (const f of FIELDS) {
    const raw = ALIASES[f].map(a => cellOf(record, header, a)).find(v => v !== undefined && v.trim() !== '');
    if (raw === undefined) continue;
    const t = raw.trim();
    request[f] = f === 'saleEnds' ? (/^(none|clear)$/i.test(t) ? '' : t) : f === 'stockStatus' ? t : num(t);
  }
  return { id: (cellOf(record, header, 'id') || '').trim(), sku: (cellOf(record, header, 'sku') || '').trim(), request };
}

/** products = Map(id -> product). @returns {{ rows, summary, updates, jumps }} (a pure function: no database). */
export function planCsv(csv, products) {
  const parsed = parseChecked(csv);
  const bySku = new Map();
  for (const p of products.values()) if (p.sku) { const k = p.sku.toLowerCase(); bySku.set(k, [...(bySku.get(k) || []), p.id]); }
  const rows = [], updates = [], seen = new Set();
  const sum = { total: 0, matched: 0, unmatched: 0, changed: 0, errors: 0, jumps: 0 };
  parsed.records.forEach((rec, i) => {
    const { id: idText, sku, request } = requestOf(rec, parsed.header);
    const row = { line: parsed.lines[i], match: null, id: null, name: '', changes: {}, errors: [], jump: false };
    sum.total++;
    let p = /^\d+$/.test(idText) ? products.get(Number(idText)) : null;
    if (p) row.match = 'id';
    else if (sku) {
      const hit = bySku.get(sku.toLowerCase()) || [];
      if (hit.length > 1) row.errors.push(`SKU matches ${hit.length} products`);
      else if (hit.length === 1) { p = products.get(hit[0]); row.match = 'sku'; }
    }
    if (p) {
      row.id = p.id; row.name = p.name; sum.matched++;
      if (seen.has(p.id)) row.errors.push('This product appears twice in the file');
      seen.add(p.id);
      const plan = planOne(p, request);
      row.changes = plan.changes;
      row.errors.push(...plan.errors.map(e => e.message));
      if (!row.errors.length) {
        if (plan.jump) { row.jump = true; sum.jumps++; updates.push({ id: p.id, value: plan.value, jump: { id: p.id, name: p.name, ...plan.jump } }); }
        else if (Object.keys(plan.value).length) updates.push({ id: p.id, value: plan.value });
        if (Object.keys(plan.changes).length) sum.changed++;
      }
    } else { sum.unmatched++; if (!row.errors.length) row.errors.push(idText || sku ? 'No product found for this id or SKU' : 'The row has no id and no SKU'); }
    if (row.errors.length) sum.errors++;
    rows.push(row);
  });
  return { rows, summary: sum, updates, jumps: updates.filter(u => u.jump).map(u => u.jump) };
}
