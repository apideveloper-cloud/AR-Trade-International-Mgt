/** A readable random password that passes the rule (8+ characters with a letter and a number). */
export function genPassword() {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz', D = '23456789', A = L + D;
  const r = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  let p = '';
  for (let i = 0; i < 8; i++) p += A[r(A.length)];
  return p + D[r(D.length)] + L[r(L.length)];
}

/** 0-4: how strong a password is (length, letters, digits, mixed case / symbol). */
export function pwScore(p) {
  const v = String(p || '');
  let n = 0;
  if (v.length >= 8) n++;
  if (/[A-Za-z]/.test(v) && /\d/.test(v)) n++;
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) n++;
  if (v.length >= 12 || /[^A-Za-z0-9]/.test(v)) n++;
  return v.length ? Math.max(1, n) : 0;
}

/** Label for each pwScore value. */
export const PW_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong'];
