/**
 * Brand URL slug. MUST match `brandSlug` in server/src/brands.js (and server/src/seoHelpers.js):
 * lower-case, every run of non a-z0-9 becomes one '-', no leading/trailing '-'.
 *
 *   brandSlug('HP')          -> 'hp'
 *   brandSlug('D-Link')      -> 'd-link'
 *   brandSlug('TP Link')     -> 'tp-link'
 *   brandSlug(' brother ')   -> 'brother'
 */
export const brandSlug = name => String(name ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
