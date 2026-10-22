/**
 * One popup at a time. Every popup asks here before opening, so the "Mega toner sale" and the newsletter
 * ("Wait — before you go") can never stack on top of each other. The admin picks the mode in Settings:
 *   one         only the first popup of a visit is shown (default)
 *   sequential  both may show in one visit, but only one at a time
 *   promo / newsletter / off
 */
let current = null;
let shown = 0;
export const popupAllowed = (name, mode = 'one') => {
  if (mode === 'off') return false;
  if (mode === 'promo' && name !== 'promo') return false;
  if (mode === 'newsletter' && name !== 'newsletter') return false;
  if (current) return false;
  if (mode === 'one' && shown > 0) return false;
  return true;
};
export const popupOpen = name => { current = name; shown++; };
export const popupClose = name => { if (current === name) current = null; };
