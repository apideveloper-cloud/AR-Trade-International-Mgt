import { cleanHtml } from '../../sanitize.js';

/** Minutes to read an HTML body at 200 words per minute (at least 1). */
export const readMins = html => Math.max(1, Math.round(String(html || '').replace(/<[^>]+>/g, ' ').split(/\s+/).length / 200));

/** True when the post's title, excerpt or category contains the search text (empty search matches all). */
export const match = (p, q) => !q || (p.title + ' ' + p.excerpt + ' ' + p.category).toLowerCase().includes(q.toLowerCase());

const slugify = (s, i) => 's' + i + '-' + s.toLowerCase().replace(/[^a-z0-9ঀ-৿]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/** Adds ids to h2/h3 so the sidebar can link to each section. */
export function withToc(html) {
  try {
    const doc = new DOMParser().parseFromString('<div id="r">' + cleanHtml(html) + '</div>', 'text/html');
    const toc = [];
    doc.querySelectorAll('#r h2, #r h3').forEach((h, i) => {
      const text = h.textContent.trim();
      if (!text) return;
      h.id = slugify(text, i);
      toc.push({ id: h.id, text, lvl: h.tagName === 'H3' ? 3 : 2 });
    });
    return { html: doc.getElementById('r').innerHTML, toc: toc.filter(t => t.lvl === 2).length > 1 ? toc.filter(t => t.lvl === 2) : toc.slice(0, 12) };
  } catch { return { html: cleanHtml(html), toc: [] }; }
}
