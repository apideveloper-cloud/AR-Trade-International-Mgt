import { Navigate, Route, Routes } from 'react-router-dom';
import { Dashboard } from '../pages/Dashboard.jsx';
import * as P from './adminPages.js';

/** The route table of the console (paths are relative to /admin). Unknown paths go to the user's home page. */
export function AdminRoutes({ staff, cats, loadCats, go, home }) {
  return (
    <Routes>
      <Route path="dashboard" element={<Dashboard go={go} staff={staff} />} />
      <Route path="orders" element={<P.Orders staff={staff} />} />
      <Route path="deliveries" element={<P.Deliveries />} />
      <Route path="customers" element={<P.Customers />} />
      <Route path="products" element={<P.Products cats={cats} staff={staff} />} />
      <Route path="categories" element={<P.Categories onChanged={loadCats} />} />
      <Route path="services" element={<P.Services />} />
      <Route path="blog" element={<P.BlogAdmin staff={staff} />} />
      <Route path="pages" element={<P.PagesAdmin staff={staff} />} />
      <Route path="content" element={<P.ContentAdmin />} />
      <Route path="reviews" element={<P.Reviews />} />
      <Route path="inbox" element={<P.Inbox />} />
      <Route path="marketing" element={<P.Marketing />} />
      <Route path="careers" element={<P.Careers />} />
      <Route path="field-customers" element={<P.FieldCustomers />} />
      <Route path="field-visits" element={<P.FieldVisits />} />
      <Route path="field-orders" element={<P.FieldOrders />} />
      <Route path="field-deliveries" element={<P.FieldDeliveries />} />
      <Route path="field-contacts" element={<P.FieldContacts />} />
      <Route path="acc-overview" element={<P.AccOverview go={go} />} />
      <Route path="acc-receivables" element={<P.AccReceivables />} />
      <Route path="acc-collections" element={<P.AccCollections />} />
      <Route path="acc-expenses" element={<P.AccExpenses />} />
      <Route path="acc-purchase" element={<P.AccPurchase />} />
      <Route path="acc-reports" element={<P.AccReports />} />
      <Route path="field-map" element={<P.FieldTeamMap />} />
      <Route path="field-attendance" element={<P.FieldAttendance />} />
      <Route path="field-approvals" element={<P.FieldApprovals staff={staff} />} />
      <Route path="field-modules" element={<P.FieldModules />} />
      <Route path="team" element={<P.Team me={staff} />} />
      <Route path="roles" element={<P.Roles />} />
      <Route path="backups" element={<P.Backups />} />
      <Route path="audit" element={<P.Audit />} />
      <Route path="inv-vendors" element={<P.InvVendors staff={staff} />} />
      <Route path="quotes" element={<P.Quotations staff={staff} />} />
      <Route path="inv-purchases" element={<P.InvPurchases staff={staff} />} />
      <Route path="inv-stock" element={<P.InvStock staff={staff} />} />
      <Route path="inv-damage" element={<P.InvDamage staff={staff} />} />
      <Route path="inv-payments" element={<P.InvPayments staff={staff} />} />
      <Route path="settings" element={<P.Settings />} />
      <Route path="*" element={<Navigate to={'/admin/' + home} replace />} />
    </Routes>
  );
}
