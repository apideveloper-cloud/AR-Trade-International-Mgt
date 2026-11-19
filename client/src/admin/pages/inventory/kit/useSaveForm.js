import { useState } from 'react';
import { useBusy } from '../../../hooks/useBusy.js';

/** Submit handling of a modal form: `submit(work)` is the form's onSubmit. It runs `work()` once at a time (no double submit),
 *  shows a thrown error in `err`, and on success calls onSaved(result) then onClose(). */
export function useSaveForm(onSaved, onClose) {
  const [busy, run] = useBusy();
  const [err, setErr] = useState('');
  const submit = work => e => {
    e.preventDefault(); setErr('');
    return run(async () => {
      try { const res = await work(); onSaved(res); onClose(); } catch (er) { setErr(er.message); }
    });
  };
  return { busy, err, setErr, submit };
}
