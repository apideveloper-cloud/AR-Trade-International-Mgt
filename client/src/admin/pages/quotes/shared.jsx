import { Chip } from '../../fieldKit.jsx';

export const TONE = { Draft: 'off', Sent: 'blue', Accepted: 'ok', Rejected: 'bad' };
export const STATUSES = ['Draft', 'Sent', 'Accepted', 'Rejected'];
export const Status = ({ s }) => <Chip tone={TONE[s] || 'off'}>{s}</Chip>;
export const CUSTOMER_KINDS = [['Existing', 'Existing customer'], ['Upcoming', 'Upcoming customer'], ['New', 'New customer']];
