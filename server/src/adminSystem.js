// Admin console: database backups, the role matrix and site settings (Master Admin / settings.manage).
// Split out of admin.js; the routes are registered on the same router, in the same order.
import { pool } from './db.js';
import { fail, parseJson, wrap } from './util.js';
import { runBackup, status as backupStatus, fileOf as backupFile, deleteBackup, setDeleteCode, setDir as setBackupDir } from './backup.js';
import { mergeDelivery, validateDelivery } from './delivery.js';
import { matrix, saveRole, DEFAULTS, MASTER, MASTER_ONLY, ROLE_NAMES } from './permissions.js';

export function mountSystemRoutes(router, guard) {
  // ---------- database backups (Master Admin only: a backup holds every customer's data) ----------
  router.get('/backups', guard(MASTER_ONLY), wrap(async (req, res) => { res.json(await backupStatus()); }));
  router.post('/backups', guard(MASTER_ONLY), wrap(async (req, res) => { res.json(await runBackup(req.body?.scope === 'files' ? 'files' : 'db', 'manual', req.staff.name)); }));
  router.put('/backups/dir', guard(MASTER_ONLY), wrap(async (req, res) => { const dir = await setBackupDir(req.body?.dir); console.log('[backup] folder changed to', dir, 'by', req.staff.name); res.json(await backupStatus()); }));
  router.get('/backups/:id/download', guard(MASTER_ONLY), wrap(async (req, res) => {
    const f = await backupFile(req.params.id);
    res.set('Cache-Control', 'no-store');
    res.download(f.full, f.name);
  }));
  router.put('/backups/delete-code', guard(MASTER_ONLY), wrap(async (req, res) => { await setDeleteCode(req.body?.code, req.body?.current); res.json(await backupStatus()); }));
  // POST (not DELETE) so the delete code travels in the body; the audit log hides it
  router.post('/backups/:id/delete', guard(MASTER_ONLY), wrap(async (req, res) => { await deleteBackup(req.params.id, req.body?.code); res.json({ ok: true }); }));

  router.get('/roles', guard(MASTER_ONLY), wrap(async (req, res) => { res.json(await matrix()); }));
  router.put('/roles/:name', guard(MASTER_ONLY), wrap(async (req, res) => {
    const name = req.params.name;
    if (!ROLE_NAMES.includes(name)) throw fail(404, 'Unknown role');
    if (name === MASTER) throw fail(400, 'The Master Admin always has full access');
    res.json({ ok: true, perms: await saveRole(name, req.body.perms, req.staff) });
  }));
  router.post('/roles/:name/reset', guard(MASTER_ONLY), wrap(async (req, res) => {
    const name = req.params.name;
    if (!ROLE_NAMES.includes(name)) throw fail(404, 'Unknown role');
    if (name === MASTER) throw fail(400, 'The Master Admin always has full access');
    res.json({ ok: true, perms: await saveRole(name, DEFAULTS[name], req.staff) });
  }));

  // ---------- settings ----------
  router.get('/settings', guard('settings.manage'), wrap(async (req, res) => {
    const [[row]] = await pool.query('SELECT v FROM settings WHERE k = "site"');
    const cur = parseJson(row.v);
    res.json({ ...cur, delivery: mergeDelivery(cur.delivery) });
  }));
  router.put('/settings', guard('settings.manage'), wrap(async (req, res) => {
    const [[row]] = await pool.query('SELECT v FROM settings WHERE k = "site"');
    const cur = parseJson(row.v);
    const b = req.body, num = v => Math.max(0, parseInt(v, 10) || 0);
    const next = {
      ...cur,
      promo: b.promo ?? cur.promo, showPromo: b.showPromo ?? cur.showPromo, showOffer: 'showOffer' in b ? !!b.showOffer : (cur.showOffer ?? true), heroTitle: b.heroTitle ?? cur.heroTitle, heroSub: b.heroSub ?? cur.heroSub,
      offerTitle: b.offerTitle ?? cur.offerTitle, offerSub: b.offerSub ?? cur.offerSub,
      insideFee: 'insideFee' in b ? num(b.insideFee) : cur.insideFee, outsideFee: 'outsideFee' in b ? num(b.outsideFee) : cur.outsideFee,
      suburbFee: 'suburbFee' in b ? num(b.suburbFee) : cur.suburbFee, freeOver: 'freeOver' in b ? num(b.freeOver) : cur.freeOver,
      coupon: b.coupon ? String(b.coupon).toUpperCase() : cur.coupon, couponPct: 'couponPct' in b ? Math.min(90, num(b.couponPct)) : cur.couponPct,
      phone: b.phone ?? cur.phone, whatsapp: b.whatsapp ?? cur.whatsapp, email: b.email ?? cur.email, address: b.address ?? cur.address,
      delivery: 'delivery' in b ? validateDelivery(b.delivery) : cur.delivery,
      payments: b.payments ?? cur.payments, svcPrices: b.svcPrices ?? cur.svcPrices,
      // home page category rows: products per category (1-20) and an on/off switch
      homeRailLimit: 'homeRailLimit' in b ? Math.min(20, Math.max(1, num(b.homeRailLimit))) : (cur.homeRailLimit ?? 20),
      homeRails: 'homeRails' in b ? !!b.homeRails : (cur.homeRails ?? true),
      // popups: only one is ever open at a time; the admin chooses which ones may show and when
      popupMode: ['one', 'sequential', 'promo', 'newsletter', 'off'].includes(b.popupMode) ? b.popupMode : (cur.popupMode ?? 'one'),
      promoDelay: 'promoDelay' in b ? Math.min(120, num(b.promoDelay)) : (cur.promoDelay ?? 1),
      nlDelay: 'nlDelay' in b ? Math.min(600, Math.max(1, num(b.nlDelay))) : (cur.nlDelay ?? 30),
      nlExit: 'nlExit' in b ? !!b.nlExit : (cur.nlExit ?? true)
    };
    await pool.query('UPDATE settings SET v = ? WHERE k = "site"', [JSON.stringify(next)]);
    res.json({ ...next, delivery: mergeDelivery(next.delivery) });
  }));
}
