import { lazy } from 'react';

const KEY = 'ar_chunk_reload';

/** React.lazy for a code-split page (`name` = the named export, default otherwise).
 *  After a deploy, a tab that is already open still asks for the old chunk file, which no longer exists. Instead of the
 *  error page, the page reloads once to pick up the new build; if the reload does not help, the error is shown as usual. */
export function lazyPage(load, name = 'default') {
  return lazy(() => load().then(
    m => { try { sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ } return { default: m[name] }; },
    err => {
      let tried = true;
      try { tried = sessionStorage.getItem(KEY) === '1'; if (!tried) sessionStorage.setItem(KEY, '1'); } catch { /* storage unavailable: do not loop */ }
      if (tried) throw err;
      window.location.reload();
      return new Promise(() => {}); // keep the loader on screen while the reload happens
    }
  ));
}
