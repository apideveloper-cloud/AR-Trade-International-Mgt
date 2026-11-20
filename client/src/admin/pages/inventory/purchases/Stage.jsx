import { Chip } from '../../../fieldKit.jsx';
import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/inventory.js';

const STAGE_TONE = { Pending: 'amber', Approved: 'blue', Stocked: 'ok', Rejected: 'bad' };
/** A purchase's stage as a coloured chip. */
export function Stage({ s }) {
  const tr = useT();
  return <Chip tone={STAGE_TONE[s] || 'off'}>{tr(s)}</Chip>;
}
