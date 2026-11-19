// GET /summary?type=sales|attendance|expenses&period=day|week|month
import { Router } from 'express';
import { guard, wrap } from '../common.js';
import { period, kfmt, seesAll } from '../report_util.js';
import { kind, scopeOf } from './shared.js';
import { salesSummary, attendanceSummary, expenseSummary } from './summaryKinds.js';

const router = Router();

router.get('/summary', guard(), wrap(async (req, res) => {
  const type = ['sales', 'attendance', 'expenses'].includes(req.query.type) ? req.query.type : 'sales';
  const win = period(kind(req.query.period));
  const [sf, sa] = scopeOf(req);
  const bars = Array(win.labels.length).fill(0);
  const { kpis, title, target, files, unit } = type === 'sales' ? await salesSummary(win, sf, sa, bars)
    : type === 'attendance' ? await attendanceSummary(win, req, bars)
      : await expenseSummary(win, sf, sa, bars);
  const peak = bars.indexOf(Math.max(...bars, 0));
  res.json({
    type, period: win.kind, label: win.label, kpis, target, files, scope: seesAll(req.staff) ? 'team' : 'me',
    chart: { title, unit, peak: Math.max(...bars) > 0 ? peak : -1, bars: win.labels.map((l, i) => ({ label: l, value: Math.round(bars[i] * 10) / 10, display: unit === 'k' ? kfmt(bars[i]) : String(Math.round(bars[i] * 10) / 10) })) }
  });
}));

export default router;
