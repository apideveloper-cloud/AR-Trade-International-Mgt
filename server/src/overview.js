// Role-aware dashboard: figures, chart series, a 7-day forecast and the auto-generated "smart guide".
// Everything is computed from the application's own transactions (orders, items, stock, customers, expenses). Nothing is invented:
// the forecast is the average of each weekday over the last 8 weeks, scaled by the recent trend, and every guide line says what it is based on.
// Split into src/overview/*; this file keeps the original import path and exports.
export { RANGES } from './overview/dates.js';
export { analyse } from './overview/analyse.js';
export { collect } from './overview/collect.js';
export { buildOverview, buildProductReport } from './overview/report.js';
