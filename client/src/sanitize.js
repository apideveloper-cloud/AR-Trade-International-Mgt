/** Strips scripts, event handlers and javascript: URLs from admin-authored HTML before it is rendered. */
export function cleanHtml(html) {
  if (!html) return '';
  try {
    const doc = new DOMParser().parseFromString('<div id="r">' + html + '</div>', 'text/html');
    const root = doc.getElementById('r');
    root.querySelectorAll('script,iframe,object,embed,style,link,meta,base,form').forEach(n => n.remove());
    root.querySelectorAll('*').forEach(el => {
      for (const a of Array.from(el.attributes)) {
        const n = a.name.toLowerCase();
        if (n.startsWith('on') || n === 'srcdoc' || ((n === 'href' || n === 'src' || n === 'xlink:href' || n === 'action' || n === 'formaction') && /^\s*(javascript|data:text\/html|vbscript)/i.test(a.value.replace(/[\u0000- ]/g, '')))) el.removeAttribute(a.name);
      }
      if (el.tagName === 'A' && el.getAttribute('target') === '_blank') el.setAttribute('rel', 'noopener noreferrer');
    });
    return root.innerHTML;
  } catch { return ''; }
}
