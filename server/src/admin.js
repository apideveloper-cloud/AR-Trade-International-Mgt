// The admin console API (/api/admin). The route groups live in admin/*.js and the older adminContent / adminEngage / adminSystem files;
// they are registered on one router in this order (it matters: for example /staff/:id comes before /staff/roles, as it always did).
import { Router } from 'express';
import { mountChatLeadAdmin } from './chatLeads.js';
import { contentRouter } from './adminContent.js';
import { mountEngageRoutes } from './adminEngage.js';
import { mountSystemRoutes } from './adminSystem.js';
import { guard } from './admin/guard.js';
import { mountAuthRoutes } from './admin/auth.js';
import { mountDashboardRoutes } from './admin/dashboard.js';
import { mountOrderRoutes } from './admin/orders.js';
import { mountCatalogRoutes } from './admin/catalog.js';
import { mountSeoRoutes } from './admin/seo.js';
import { mountSeoItemRoutes } from './admin/seoItems.js';
import { mountSeoBulkRoutes } from './admin/seoBulk.js';
import { mountSeoCsvRoutes } from './admin/seoCsvRoutes.js';
import { mountSeoRedirectsRoutes } from './admin/seoRedirects.js';
import { mountSeoHistoryRoutes } from './admin/seoHistory.js';
import { mountCustomerRoutes } from './admin/customers.js';
import { mountTeamRoutes } from './admin/team.js';
import { mountSeoAutomationRoutes } from './admin/seoAutomation.js';
import { mountGrowthRoutes } from './admin/growth.js';
import { mountGrowthPriceRoutes } from './admin/growthPrice.js';
import { mountGrowthCheckRoutes } from './admin/growthChecks.js';
import { mountGrowthReviewRoutes } from './admin/growthReviews.js';
import { mountGrowthMerchantRoutes } from './admin/growthMerchant.js';
import { afterAdminWrite } from './seoAutomation.js';

export { guard }; // other route files (field, hub, inventory, audit, ...) import the guard from here

const router = Router();
router.use(afterAdminWrite); // purges cached SEO pages / sitemap after every successful admin write, optional IndexNow ping
mountAuthRoutes(router, guard);
mountDashboardRoutes(router, guard);
mountOrderRoutes(router, guard);
mountCatalogRoutes(router, guard);
mountSeoRoutes(router, guard); // SEO templates, robots.txt, preview (seo.manage)
mountSeoItemRoutes(router, guard); // per-item SEO tab, slugs, alt text, brand list (seo.manage)
mountSeoBulkRoutes(router, guard); // SEO product list, bulk actions, dashboard (seo.manage)
mountSeoCsvRoutes(router, guard); // SEO CSV export / import (seo.manage)
mountSeoRedirectsRoutes(router, guard); // redirects, 404 monitor (seo.manage)
mountSeoHistoryRoutes(router, guard); // SEO change history and revert (seo.manage)
mountSeoAutomationRoutes(router, guard); // IndexNow, sitemap rebuild, feed preview (seo.manage)
mountGrowthRoutes(router, guard); // Google / Bing connections, verification files, sitemap submit, logs, jobs
mountGrowthPriceRoutes(router, guard); // price and stock grid, CSV, history (Search & Growth)
mountGrowthCheckRoutes(router, guard); // price consistency checker (Search & Growth)
mountGrowthReviewRoutes(router, guard); // review requests: stats, list, settings, templates (Search & Growth)
mountGrowthMerchantRoutes(router, guard); // Merchant Center feed settings, product grid, API sync (Search & Growth)
mountCustomerRoutes(router, guard); // customers, password resets, service requests
router.use(contentRouter(guard));
mountEngageRoutes(router, guard);
mountChatLeadAdmin(router, guard);
mountTeamRoutes(router, guard);
mountSystemRoutes(router, guard);

export default router;
