// The daily series and the 7-day forecast: the average of each weekday over the last 8 weeks, scaled by the recent trend. Pure.
import { RANGES, addDays, clamp, parse, sum } from './dates.js';

/** Zero-filled daily series ending on the reference day, long enough for the chosen period and its previous twin. */
export function dailySeries(raw, S) {
  const byDay = new Map((raw.days || []).map(r => [r.d, r]));
  const full = [];
  for (let i = S - 1; i >= 0; i--) {
    const d = addDays(raw.ref, -i);
    const r = byDay.get(d);
    full.push({ d, wd: parse(d).getUTCDay(), v: r ? Number(r.v) : 0, n: r ? Number(r.n) : 0 });
  }
  return full;
}

/** Everything the sales cards and the smart guide need: period totals, weekday profile, trend, confidence and the next 7 days. */
export function buildForecast(raw) {
  const N = RANGES[raw.range] ? Number(raw.range) : 30, S = Math.max(60, 2 * N), lab = RANGES[N];
  const perTxt = N === 1 ? 'today' : 'in the last ' + lab, prevTxt = N === 1 ? 'yesterday' : 'the previous ' + lab;
  const full = dailySeries(raw, S);
  const series = full.slice(-60); // the forecast always works from the last 60 days
  const last = (n, k) => series.slice(60 - n, 60).map(x => x[k]);
  const rev30 = sum(full.slice(S - N), x => x.v), revPrev30 = sum(full.slice(S - 2 * N, S - N), x => x.v); // "30" = the chosen period
  const ord30 = sum(full.slice(S - N), x => x.n), ordPrev30 = sum(full.slice(S - 2 * N, S - N), x => x.n);
  const rev7 = sum(last(7, 'v')), revPrev7 = sum(series.slice(46, 53), x => x.v);

  const prof = Array.from({ length: 7 }, () => ({ v: 0, n: 0, days: 0 }));
  series.slice(4).forEach(x => { prof[x.wd].v += x.v; prof[x.wd].n += x.n; prof[x.wd].days++; });
  const profile = prof.map(p => ({ v: p.days ? p.v / p.days : 0, n: p.days ? p.n / p.days : 0 }));
  const recent = sum(last(14, 'v')), before = sum(series.slice(32, 46), x => x.v);
  const trend = before > 0 ? clamp(recent / before, 0.6, 1.6) : 1;
  const orders56 = sum(series.slice(4), x => x.n);
  const confidence = orders56 >= 60 ? 'good' : orders56 >= 15 ? 'fair' : 'low';
  const spread = confidence === 'good' ? 0.2 : confidence === 'fair' ? 0.35 : 0.55;
  const forecast = [];
  for (let i = 1; i <= 7; i++) {
    const d = addDays(raw.ref, i), wd = parse(d).getUTCDay();
    const v = profile[wd].v * trend;
    forecast.push({ d, wd, v: Math.round(v), n: Math.round(profile[wd].n * trend * 10) / 10, lo: Math.round(v * (1 - spread)), hi: Math.round(v * (1 + spread)) });
  }
  return {
    N, lab, perTxt, prevTxt, full, series, rev30, revPrev30, ord30, ordPrev30, rev7, revPrev7, today: series[59], profile, trend, orders56, confidence, forecast,
    fcTotal: sum(forecast, x => x.v), fcOrders: Math.round(sum(forecast, x => x.n)),
    bestWd: profile.map((p, i) => [i, p.v]).sort((a, b) => b[1] - a[1])[0],
    slowWd: profile.map((p, i) => [i, p.v]).sort((a, b) => a[1] - b[1])[0]
  };
}
