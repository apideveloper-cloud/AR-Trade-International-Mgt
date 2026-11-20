// Job handlers of the Search & Growth console. Imported once by index.js.
import { registerHandler, registerRecurring } from './jobs.js';
import { submitSitemapAll } from './sitemapSubmit.js';
import './registerPrice.js';
import './registerChecks.js';
import './registerReviews.js';
import './registerMerchant.js';
import './registerGsc.js';
import './registerSchema.js';
import './registerBiz.js';
import './registerLinks.js';

export async function sitemapResubmit() {
  let results;
  try { results = await submitSitemapAll({}); }
  catch (e) { if (/preferred domain/i.test(e.message)) return { skipped: true, reason: 'no preferred domain' }; throw e; } // nothing to retry until the owner sets the domain
  const tried = Object.entries(results).filter(([, r]) => !r.skipped);
  if (!tried.length) return { skipped: true };
  const bad = tried.filter(([, r]) => !r.ok);
  if (bad.length) throw new Error(bad.map(([e, r]) => `${e}: ${r.error}`).join('; ')); // the queue retries with backoff
  return { results };
}
registerHandler('sitemap_resubmit', sitemapResubmit);
registerRecurring('sitemap_resubmit', 24 * 3600e3);
