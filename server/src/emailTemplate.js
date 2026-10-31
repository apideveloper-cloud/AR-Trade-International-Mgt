// Branded marketing email: logo, hero banner, product grid with discount badges, call-to-action button, legal footer.
// Table layout and inline styles only, because mail apps (Gmail, Outlook) ignore most modern CSS.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '৳ ' + Number(n || 0).toLocaleString('en-US');

/** Hero colours the admin can pick; the first value is the solid fallback every mail app understands. */
export const HEROES = {
  navy: ['#0b1631', '#173a7a'], pink: ['#f4a9b8', '#f9d3dc'], blue: ['#bfe0f8', '#e4f2fc'], green: ['#0f6b52', '#1fa07a'], red: ['#b3261e', '#e8573f'], gold: ['#b7791f', '#f0b429']
};
const DARK = new Set(['navy', 'green', 'red', 'gold']);

const abs = (base, u) => (!u ? '' : /^https?:\/\//i.test(u) ? u : base + (u.startsWith('/') ? '' : '/') + u);

function card(p, base, w) {
  const off = p.old > p.price ? Math.round((p.old - p.price) / p.old * 100) : 0;
  const img = abs(base, p.img);
  return `<td width="${w}" valign="top" style="padding:6px"><a href="${esc(base + '/product/' + p.id)}" style="text-decoration:none;color:#0b1631;display:block;border:1px solid #e6e9f0;border-radius:12px;overflow:hidden;background:#fff">
<div style="background:#ffffff;text-align:center;height:200px;line-height:200px;font-size:0">${img ? `<img src="${esc(img)}" alt="${esc(p.name)}" style="vertical-align:middle;max-width:90%;max-height:190px;width:auto;height:auto">` : ''}</div>
<div style="padding:10px 12px"><div style="font:600 13px/1.35 Arial,sans-serif;color:#0b1631;min-height:36px">${esc(p.name)}</div>
<div style="padding-top:6px;font:800 16px Arial,sans-serif;color:#0b1631">${off ? `<span style="display:inline-block;background:#e0245e;color:#fff;font:800 11px Arial,sans-serif;padding:3px 6px;border-radius:4px;margin-right:6px">-${off}%</span>` : ''}${money(p.price)}${off ? ` <span style="font:400 12px Arial,sans-serif;color:#8a8f9b;text-decoration:line-through">${money(p.old)}</span>` : ''}</div></div></a></td>`;
}

export function renderEmail({ subject, preheader, kicker, headline, body, hero = 'navy', products = [], cta, ctaUrl, prefsUrl, siteUrl: base = '' }) {
  const [c1, c2] = HEROES[hero] || HEROES.navy;
  const ink = DARK.has(hero) ? '#ffffff' : '#0b1631';
  const paras = String(body || '').split(/\n+/).filter(Boolean);
  const list = products.slice(0, 8);
  const rows = [];
  for (let i = 0; i < list.length; i += 2) {
    const pair = list.slice(i, i + 2);
    rows.push(`<tr>${pair.map(p => card(p, base, pair.length === 1 ? '100%' : '50%')).join('')}</tr>`);
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject || headline)}</title></head>
<body style="margin:0;padding:0;background:#f1f3f8">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader || '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f3f8"><tr><td align="center" style="padding:18px 8px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td align="center" style="padding:20px 16px 14px;font:800 24px Arial,sans-serif;color:#0b1631;letter-spacing:-.5px"><a href="${esc(base || '#')}" style="color:#0b1631;text-decoration:none">AR <span style="color:#e0245e">Trade</span> International</a></td></tr>
<tr><td bgcolor="${c1}" style="background:${c1};background-image:linear-gradient(135deg,${c1},${c2});padding:30px 26px">
${kicker ? `<div style="font:600 14px Georgia,serif;color:${ink};opacity:.85;padding-bottom:6px">${esc(kicker)}</div>` : ''}
<div style="font:800 30px/1.15 Arial,sans-serif;color:${ink};letter-spacing:.5px">${esc(headline || subject)}</div>
${paras.map(p => `<p style="margin:12px 0 0;font:15px/1.5 Arial,sans-serif;color:${ink}">${esc(p)}</p>`).join('')}
</td></tr>
${rows.length ? `<tr><td style="padding:14px 14px 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join('')}</table></td></tr>` : ''}
${cta && ctaUrl ? `<tr><td align="center" style="padding:20px 16px 26px"><a href="${esc(ctaUrl)}" style="display:inline-block;background:#000000;color:#ffffff;font:700 16px Georgia,serif;padding:15px 52px;text-decoration:none">${esc(cta)}</a></td></tr>` : ''}
<tr><td style="padding:16px 22px 22px;border-top:1px solid #eceff5;font:12px/1.5 Arial,sans-serif;color:#7a8196;text-align:center">You are receiving this because you subscribed to AR Trade International, Dhaka.<br><a href="${esc(prefsUrl || '#')}" style="color:#2f5fd0">Unsubscribe or change what you receive</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = [headline || subject, '', ...paras, '', ...list.map(p => `${p.name} - ${money(p.price)}${p.old > p.price ? ` (was ${money(p.old)})` : ''}: ${base}/product/${p.id}`), cta && ctaUrl ? `\n${cta}: ${ctaUrl}` : '', '', 'Unsubscribe or change what you receive: ' + (prefsUrl || '')].join('\n');
  return { html, text };
}
