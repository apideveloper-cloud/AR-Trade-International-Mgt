// Call log. There is no VoIP backend: a call is placed through the phone (GSM) or WhatsApp / IMO, and the app records it here.
//   POST /api/field/calls/log   { peerName, peerPhone, via: 'gsm'|'wa'|'imo', direction?: 'out'|'in', seconds? }
//   PUT  /api/field/calls/log/:id { seconds }   the app reports how long the call screen stayed open (call length)
//   GET  /api/field/calls/log   my recent calls, newest first
import { Router } from 'express';
import { pool, wrap, fail, guard, UTC_TS } from '../common.js';

const router = Router();
const VIA = ['gsm', 'wa', 'imo'];

router.post('/log', guard(), wrap(async (req, res) => {
  const name = String(req.body.peerName || '').trim().slice(0, 160);
  if (!name) throw fail(400, 'Who was called?');
  const via = VIA.includes(req.body.via) ? req.body.via : 'gsm';
  const direction = req.body.direction === 'in' ? 'in' : 'out';
  const seconds = Math.max(0, Math.min(86400, parseInt(req.body.seconds, 10) || 0));
  const [r] = await pool.query('INSERT INTO field_call_log (staff_id, peer_name, peer_phone, via, direction, seconds) VALUES (?,?,?,?,?,?)',
    [req.staff.id, name, String(req.body.peerPhone || '').slice(0, 30), via, direction, seconds]);
  res.json({ id: r.insertId });
}));

router.put('/log/:id', guard(), wrap(async (req, res) => {
  const seconds = Math.max(0, Math.min(86400, parseInt(req.body.seconds, 10) || 0));
  const [r] = await pool.query('UPDATE field_call_log SET seconds = ? WHERE id = ? AND staff_id = ?', [seconds, req.params.id, req.staff.id]);
  if (!r.affectedRows) throw fail(404, 'Call not found');
  res.json({ id: Number(req.params.id), seconds });
}));

router.get('/log', guard(), wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, peer_name, peer_phone, via, direction, seconds, ${UTC_TS('created_at')} at FROM field_call_log WHERE staff_id = ? ORDER BY id DESC LIMIT 60`,
    [req.staff.id]);
  res.json(rows.map(r => ({ id: r.id, name: r.peer_name, phone: r.peer_phone, via: r.via, direction: r.direction, seconds: r.seconds, at: r.at })));
}));

export default router;
