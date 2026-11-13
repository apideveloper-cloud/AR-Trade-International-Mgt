// Small helpers shared by the admin route files.

/** ?size= (5-100, default 10) and ?page= from a list request. */
export const page = req => {
  const size = Math.min(100, Math.max(5, parseInt(req.query.size, 10) || 10));
  const p = Math.min(1000000, Math.max(1, parseInt(req.query.page, 10) || 1));
  return { size, p, offset: (p - 1) * size };
};
/** A LIKE pattern that matches anywhere in the text. */
export const like = q => `%${String(q || '').trim()}%`;
