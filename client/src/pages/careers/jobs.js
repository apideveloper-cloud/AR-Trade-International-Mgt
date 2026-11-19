import { useEffect, useState } from 'react';
import { api } from '../../api.js';

/** Whole days until the job deadline (<= 0 means closed). */
export const daysLeft = j => Math.ceil((new Date(j.deadline) - Date.now()) / 864e5);

/** Human label for the deadline. */
export const deadlineLabel = j => { const d = daysLeft(j); return d <= 0 ? 'Closed' : d === 1 ? 'Closes tomorrow' : d + ' days left'; };

/** Colour modifier class for the deadline label. */
export const deadlineTone = j => (daysLeft(j) < 7 ? 'cr-dl-soon' : 'cr-dl-ok');

/** "3 vacancies" / "1 vacancy". */
export const vacancyLabel = j => j.vacancies + (j.vacancies > 1 ? ' vacancies' : ' vacancy');

/** Loads all jobs once (null while loading, [] on failure). */
export function useJobs() {
  const [jobs, setJobs] = useState(null);
  useEffect(() => {
    let live = true;
    api.get('/jobs').then(r => live && setJobs(r)).catch(() => live && setJobs([]));
    return () => { live = false; };
  }, []);
  return jobs;
}
