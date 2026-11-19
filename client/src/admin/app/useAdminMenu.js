import { useEffect, useRef, useState } from 'react';
import { NAV } from '../nav.js';

/** Left-menu state: search text, the one open group (accordion), the phone drawer, and the focus / scroll behaviour around them. */
export function useAdminMenu(pageKey) {
  const [menuQ, setMenuQ] = useState(''); // left-menu search
  const [openG, setOpenG] = useState(''); // the group of the page you are on opens by itself
  const [menuOpen, setMenuOpen] = useState(false); // phone width: the menu is a side drawer opened by the hamburger button
  const menuQRef = useRef('');
  menuQRef.current = menuQ; // read by the Escape handler below without re-binding it on every keystroke

  useEffect(() => { const g = NAV.find(([, items]) => items.some(i => i[0] === pageKey)); if (g) setOpenG(g[0]); }, [pageKey]);
  useEffect(() => { setMenuOpen(false); }, [pageKey]); // choosing a page closes the drawer
  useEffect(() => { // widening the window past the phone layout also closes it, so it does not pop open again later
    const mq = window.matchMedia('(min-width: 901px)'), on = e => { if (e.matches) setMenuOpen(false); };
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = e => {
      if (e.key === 'Escape') {
        if (menuQRef.current && e.target?.matches?.('.nav-search input')) return; // the search box clears itself first; a second Escape closes the menu
        setMenuOpen(false);
      } else if (e.key === 'Tab') { // keep Tab / Shift+Tab inside the open drawer
        const dr = document.querySelector('.adm-drawer');
        if (!dr) return;
        const fs = [...dr.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(el => getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length);
        if (!fs.length) return;
        const first = fs[0], last = fs[fs.length - 1];
        if (!dr.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('adm-menu-open');
    const f = setTimeout(() => document.querySelector('.adm-drawer-hd button')?.focus(), 60);
    return () => {
      document.removeEventListener('keydown', onKey); document.body.classList.remove('adm-menu-open'); clearTimeout(f);
      if (document.querySelector('.adm-drawer')?.contains(document.activeElement)) document.querySelector('.adm-burger')?.focus(); // focus goes back to the button that opened it
    };
  }, [menuOpen]);
  useEffect(() => { // keep the current page's link in view in a long menu (after the group has finished opening)
    const t = setTimeout(() => document.querySelector('.adm-nav a.on')?.scrollIntoView({ block: 'nearest' }), 260);
    return () => clearTimeout(t);
  }, [pageKey]);
  return { menuQ, setMenuQ, openG, setOpenG, menuOpen, setMenuOpen };
}
