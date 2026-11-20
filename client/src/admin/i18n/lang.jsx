import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Admin language: BAN (Bangla) or ENG (English). The English text of the screen is the key: t('Check now') answers the Bangla
// text from the registered dictionaries when Bangla is chosen, and the English text itself otherwise (or when nothing is translated yet).
// Placeholders: t('{n} pages checked', { n: 5 }). The choice is remembered in this browser.
const KEY = 'ar_admin_lang';
const DICT = new Map();
const missing = new Set();

/** Adds translations: registerDict({ 'English text': 'বাংলা লেখা', ... }). Each page area has its own file in i18n/dict. */
export function registerDict(obj) { for (const [k, v] of Object.entries(obj)) DICT.set(k, v); }
/** English texts shown in Bangla mode that have no translation yet (used by the developer to find what is left). */
export const missingKeys = () => [...missing];

const fill = (s, vars) => (vars ? String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m)) : s);
export function translate(lang, en, vars) {
  if (lang !== 'bn') return fill(en, vars);
  const bn = DICT.get(en);
  if (bn === undefined && /[A-Za-z]{3}/.test(String(en))) missing.add(en);
  return fill(bn === undefined ? en : bn, vars);
}

const read = () => { try { return localStorage.getItem(KEY) === 'bn' ? 'bn' : 'en'; } catch { return 'en'; } };
const Ctx = createContext({ lang: 'en', setLang: () => {}, t: (s, v) => fill(s, v), inProvider: false });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(read);
  const setLang = useCallback(l => { setLangState(l === 'bn' ? 'bn' : 'en'); try { localStorage.setItem(KEY, l === 'bn' ? 'bn' : 'en'); } catch { /* the choice is just not remembered */ } }, []);
  const t = useCallback((en, vars) => translate(lang, en, vars), [lang]);
  const value = useMemo(() => ({ lang, setLang, t, inProvider: true }), [lang, setLang, t]);
  useEffect(() => { /* keep a second tab in step */
    const on = e => { if (e.key === KEY) setLangState(e.newValue === 'bn' ? 'bn' : 'en'); };
    window.addEventListener('storage', on); return () => window.removeEventListener('storage', on);
  }, []);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
/** true only inside LangProvider (the sign-in screen is also used by the Email Center and Delivery Hub, which have no language switch). */
export const useInProvider = () => useContext(Ctx).inProvider === true;
/** const tr = useT();  then  tr('Save')  or  tr('{n} products', { n }) */
export const useT = () => useContext(Ctx).t;

/** The BAN | ENG switch for the top bar. */
export function LangSwitch() {
  const { lang, setLang } = useLang();
  return (
    <div className="lang-sw" role="group" aria-label={lang === 'bn' ? 'ভাষা' : 'Language'}>
      <button type="button" className={lang === 'bn' ? 'on' : ''} aria-pressed={lang === 'bn'} onClick={() => setLang('bn')} title="বাংলা">BAN</button>
      <button type="button" className={lang === 'en' ? 'on' : ''} aria-pressed={lang === 'en'} onClick={() => setLang('en')} title="English">ENG</button>
    </div>
  );
}
