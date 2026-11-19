import { deadlineLabel, deadlineTone } from './jobs.js';

/** Coloured "N days left" label for a job. */
export default function Deadline({ j }) {
  return <span className={'cr-dl ' + deadlineTone(j)}>{deadlineLabel(j)}</span>;
}
