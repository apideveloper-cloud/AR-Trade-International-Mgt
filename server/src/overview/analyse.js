// Pure analysis of the collected figures. `raw` is what collect() returns; `has(name)` says what the signed-in person may see.
import { buildForecast } from './forecast.js';
import { buildGuide } from './guide.js';
import { buildTodo, customersSection, deliverySection, financeSection, salesSection, stockSection } from './sections.js';

export function analyse(raw, has) {
  const out = { asOf: raw.ref, sections: [], todo: [], insights: [] };
  const sales = has('orders.view') && has('dashboard.view');
  const followsMoney = has('hub.cash') || has('field.approve') || has('orders.status'); // roles that follow up payments
  // what this person's dashboard leads with: buyers start from stock, everyone else from sales
  out.focus = has('inventory.manage') && !has('orders.status') && !has('hub.cash') && has('products.view') ? 'stock' : 'sales';

  const f = buildForecast(raw);
  if (sales) { out.sections.push('sales'); out.sales = salesSection(raw, f); }
  if (has('products.view')) { out.sections.push('stock'); out.stock = stockSection(raw); }
  if (has('customers.view')) { out.sections.push('customers'); out.customers = customersSection(raw); }
  if (has('hub.view') || has('hub.cash')) { out.sections.push('delivery'); out.delivery = deliverySection(raw); }
  if (followsMoney) { out.sections.push('finance'); out.finance = financeSection(raw); }
  out.todo = buildTodo(raw, has);
  out.insights = buildGuide(out, raw, has, f);
  return out;
}
