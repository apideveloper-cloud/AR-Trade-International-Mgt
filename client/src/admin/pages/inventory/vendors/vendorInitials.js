/** Two letters for the avatar: the first letters of the first two words ("Global Toner BD" -> GT), or the first two letters of a single word. */
export const initials = name => {
  const words = String(name || '').trim().split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).map(w => Array.from(w.replace(/^[^\p{L}\p{N}]+/u, '')));
  if (!words.length) return '?';
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2).join('')).toUpperCase();
};
