import { lazyPage } from '../../lazyPage.js';

// Pages load on demand (one chunk per area), so the first screen of the console stays small; the map library only loads with the Field pages.
const pick = (load, ...names) => Object.fromEntries(names.map(n => [n, lazyPage(load, n)]));

export const { Categories, Products } = pick(() => import('../pages/Catalog.jsx'), 'Categories', 'Products');
export const { Careers, Inbox, Marketing, Reviews, Services } = pick(() => import('../pages/Engage.jsx'), 'Careers', 'Inbox', 'Marketing', 'Reviews', 'Services');
export const { BlogAdmin } = pick(() => import('../pages/BlogAdmin.jsx'), 'BlogAdmin');
export const { PagesAdmin } = pick(() => import('../pages/PagesAdmin.jsx'), 'PagesAdmin');
export const { ContentAdmin } = pick(() => import('../pages/ContentAdmin.jsx'), 'ContentAdmin');
export const { Customers, Deliveries, Orders } = pick(() => import('../pages/Sales.jsx'), 'Customers', 'Deliveries', 'Orders');
export const { Backups } = pick(() => import('../pages/Backups.jsx'), 'Backups');
export const { FieldApprovals, FieldAttendance, FieldModules, FieldTeamMap } = pick(() => import('../pages/Field.jsx'), 'FieldApprovals', 'FieldAttendance', 'FieldModules', 'FieldTeamMap');
export const { FieldContacts, FieldCustomers, FieldDeliveries, FieldOrders, FieldVisits } = pick(() => import('../pages/FieldSales.jsx'), 'FieldContacts', 'FieldCustomers', 'FieldDeliveries', 'FieldOrders', 'FieldVisits');
export const { AccCollections, AccExpenses, AccOverview, AccPurchase, AccReceivables, AccReports } = pick(() => import('../pages/Accounts.jsx'), 'AccCollections', 'AccExpenses', 'AccOverview', 'AccPurchase', 'AccReceivables', 'AccReports');
export const { InvDamage, InvPayments, InvPurchases, InvStock, InvVendors } = pick(() => import('../pages/Inventory.jsx'), 'InvDamage', 'InvPayments', 'InvPurchases', 'InvStock', 'InvVendors');
export const { Quotations } = pick(() => import('../pages/Quotations.jsx'), 'Quotations');
export const { Settings, Team } = pick(() => import('../pages/System.jsx'), 'Settings', 'Team');
export const { Roles } = pick(() => import('../pages/Roles.jsx'), 'Roles');
export const { Audit } = pick(() => import('../pages/Audit.jsx'), 'Audit');
export const { Seo } = pick(() => import('../pages/Seo.jsx'), 'Seo');
