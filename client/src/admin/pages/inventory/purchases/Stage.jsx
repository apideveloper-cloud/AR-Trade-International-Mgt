import { Chip } from '../../../fieldKit.jsx';

const STAGE_TONE = { Pending: 'amber', Approved: 'blue', Stocked: 'ok', Rejected: 'bad' };
/** A purchase's stage as a coloured chip. */
export const Stage = ({ s }) => <Chip tone={STAGE_TONE[s] || 'off'}>{s}</Chip>;
