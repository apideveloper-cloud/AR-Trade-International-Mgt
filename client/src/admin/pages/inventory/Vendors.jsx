import { useState } from 'react';
import { Tabs } from '../../fieldKit.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/inventory.js';
import { VendorList } from './vendors/VendorList.jsx';
import { VendorTransactions } from './vendors/VendorTransactions.jsx';

export { VendorForm } from './vendors/VendorForm.jsx';
export { initials } from './vendors/vendorInitials.js';

/** Vendors page: the vendor list, or every vendor transaction in one grid. */
export function InvVendors({ staff }) {
  const tr = useT();
  const [tab, setTab] = useState('vendors');
  return (
    <>
      <Tabs items={[['vendors', tr('Vendors')], ['transactions', tr('Transactions')]]} value={tab} onChange={setTab} />
      {tab === 'vendors' ? <VendorList staff={staff} /> : <VendorTransactions />}
    </>
  );
}
