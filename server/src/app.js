// The Express application: middleware and routers in the order they must run. index.js starts it; nothing here listens or touches the database at import.
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import { auditMiddleware, auditRouter } from './audit.js';
import adminRouter from './admin.js';
import accountRouter from './account.js';
import fieldRouter from './field.js';
import { hubRouter, liveRouter } from './hub.js';
import { invRouter } from './inventory.js';
import { quoteRouter } from './quotation.js';
import { mktRouter, prefsRouter } from './mkt.js';
import { securityHeaders, mountSignInLimits } from './middleware/security.js';
import { invalidateBootCacheOnWrite } from './middleware/cache.js';
import { mountUploads, mountClient } from './middleware/static.js';
import { jsonErrorHandler } from './middleware/errors.js';
import { mountCatalogRoutes } from './routes/catalog.js';
import { mountContentRoutes } from './routes/content.js';
import { mountAuthRoutes } from './routes/auth.js';
import { mountOrderRoutes } from './routes/orders.js';
import { mountFormRoutes } from './routes/forms.js';
import { mountChatRoutes } from './routes/chat.js';
import { mountCareersRoutes } from './routes/careers.js';

const app = express();
app.set('trust proxy', 1); // behind Nginx: req.ip is the real client
app.disable('x-powered-by');
app.use(securityHeaders);
app.use(compression()); // the catalogue JSON is large; gzip keeps first load fast
if (process.env.NODE_ENV !== 'production') app.use(cors()); // production serves the app and API from one origin
app.use(auditMiddleware); // records every change made through the staff APIs (see audit.js)

// body parsers: the larger limits are mounted first so the global 3 MB parser skips those paths
app.use('/api/admin', express.json({ limit: '10mb' })); // image uploads (base64) are staff-only
app.use('/api/quotes/scan', express.json({ limit: '9mb' })); // a photo of the terms (base64), staff-only
app.use('/api/field/expenses', express.json({ limit: '8mb' })); // voucher photos (base64, up to 4 MB as a file) arrive in the expense claim
app.use(express.json({ limit: '3mb' })); // everything else: small bodies (CV uploads are capped at 2 MB)
app.use('/api', invalidateBootCacheOnWrite); // any write throws the kept /api/bootstrap catalogue away

mountUploads(app);

// storefront API
mountCatalogRoutes(app);
mountContentRoutes(app);
mountAuthRoutes(app);
mountOrderRoutes(app);
mountFormRoutes(app);
mountChatRoutes(app);
mountCareersRoutes(app);

// staff, field-app and back-office APIs
mountSignInLimits(app);
app.use('/api/admin/audit', auditRouter); // before adminRouter so /audit is never taken for an admin id
app.use('/api/admin', adminRouter);
app.use('/api/inv', invRouter);
app.use('/api/quotes', quoteRouter);
app.use('/api/account', accountRouter);
app.use('/api/field', fieldRouter);
app.use('/api/hub', hubRouter);
app.use('/api/live', liveRouter);
app.use('/api/mkt', mktRouter);
app.use('/api/prefs', prefsRouter);

mountClient(app); // production: the built client, robots.txt, sitemap.xml and the SEO HTML shell (must stay last)
app.use(jsonErrorHandler);

export default app;
