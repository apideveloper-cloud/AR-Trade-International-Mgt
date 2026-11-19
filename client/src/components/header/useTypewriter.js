import { useEffect } from 'react';

const WORDS_HOLD = 'Type a model or part no.…';

/** Types the given words into the search box placeholder; pauses while the box is focused or filled. */
export default function useTypewriter(words, ref) {
  useEffect(() => {
    const list = words.filter(Boolean);
    if (!list.length) return undefined;
    let w = 0, i = 0, del = false, hold = 0;
    const t = setInterval(() => {
      const el = ref.current;
      if (!el) return;
      if (el.value || document.activeElement === el) { if (el.placeholder !== WORDS_HOLD) el.placeholder = WORDS_HOLD; return; }
      if (hold > 0) { hold--; return; }
      const s = list[w];
      if (!del) { i++; if (i >= s.length) { del = true; hold = 22; } }
      else { i -= 2; if (i <= 0) { i = 0; del = false; w = (w + 1) % list.length; hold = 4; } }
      el.placeholder = s.slice(0, Math.max(0, i)) + (del && hold ? '' : '|');
    }, 70);
    return () => clearInterval(t);
  }, [words, ref]);
}
