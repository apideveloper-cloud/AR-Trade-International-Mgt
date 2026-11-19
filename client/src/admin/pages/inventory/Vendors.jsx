import { useState } from 'react';
import { Tabs } from '../../fieldKit.jsx';
import { VendorList } from './vendors/VendorList.jsx';
import { VendorTransactions } from './vendors/VendorTransactions.jsx';

export { VendorForm } from './vendors/VendorForm.jsx';
export { initials } from './vendors/vendorInitials.js';

/** Vendors page: the vendor list, or every vendor transaction in one grid. */
export function InvVendors({ staff }) {
  const [tab, setTab] = useState('vendors');
  return (
    <>
      <Tabs items={[['vendors', 'Vendors'], ['transactions', 'Transactions']]} value={tab} onChange={setTab} />
      {tab === 'vendors' ? <VendorList staff={staff} /> : <VendorTransactions />}
    </>
  );
}
