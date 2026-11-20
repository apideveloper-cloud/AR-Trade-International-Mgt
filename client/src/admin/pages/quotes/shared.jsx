import { Chip } from '../../fieldKit.jsx';
import '../../i18n/dict/accounts.js';
import { useT } from '../../i18n/lang.jsx';

export const TONE = { Draft: 'off', Sent: 'blue', Accepted: 'ok', Rejected: 'bad' };
export const STATUSES = ['Draft', 'Sent', 'Accepted', 'Rejected'];
export const Status = ({ s }) => { const tr = useT(); return <Chip tone={TONE[s] || 'off'}>{tr(s)}</Chip>; };
export const CUSTOMER_KINDS = [['Existing', 'Existing customer'], ['Upcoming', 'Upcoming customer'], ['New', 'New customer']];
