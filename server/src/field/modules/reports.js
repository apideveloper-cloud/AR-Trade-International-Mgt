// Reports for managers / accountants / admins (everyone else sees only their own figures). Code lives in src/field/reports/*.
//   GET /api/field/reports/summary?type=sales|attendance|expenses&period=day|week|month
//   GET /api/field/reports/expense?month=YYYY-MM&category=&status=
//   GET /api/field/reports/collection?period=day|week|month
//   GET /api/field/reports/export?name=sales|collection|delivery|attendance|route|leave|expense|approvals|ledger&period=&format=json|csv
import { Router } from 'express';
import summaryRoutes from '../reports/summary.js';
import expenseRoutes from '../reports/expense.js';
import collectionRoutes from '../reports/collection.js';
import exportRoutes from '../reports/export.js';

const router = Router();
router.use(summaryRoutes, expenseRoutes, collectionRoutes, exportRoutes);

export default router;
