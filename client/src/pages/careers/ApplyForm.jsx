import { useState } from 'react';
import { api } from '../../api.js';
import Deadline from './Deadline.jsx';
import CvUpload from './CvUpload.jsx';

/** Job application form (validates phone + CV, posts to /jobs/:id/apply). */
export default function ApplyForm({ j, user, onDone }) {
  const [cv, setCv] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const onCv = e => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1048576) { setErr('CV must be under 2 MB.'); return; }
    const r = new FileReader();
    r.onload = () => { setCv({ name: f.name, data: r.result }); setErr(''); };
    r.readAsDataURL(f);
  };
  const submit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target).entries());
    if (!/^01[3-9]\d{8}$/.test(String(d.phone).replace(/\D/g, '').slice(-11))) { setErr('Enter a valid Bangladeshi mobile number.'); return; }
    if (!cv) { setErr('Please attach your CV (PDF or Word).'); return; }
    setBusy(true);
    try {
      const r = await api.post(`/jobs/${j.id}/apply`, { ...d, cvName: cv.name, cvData: cv.data });
      onDone(r.id); window.scrollTo(0, 0);
      return;
    } catch (er) { setErr(er.message); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="cr-form">
      <div className="cr-form-hd"><b className="cr-form-h">Apply for this job</b><Deadline j={j} /></div>
      <label className="jlbl">Full name<input className="jfield" name="name" required defaultValue={user?.name} /></label>
      <div className="cr-grid2">
        <label className="jlbl">Mobile<input className="jfield" name="phone" required defaultValue={user?.phone} placeholder="01XXXXXXXXX" /></label>
        <label className="jlbl">Email<input className="jfield" type="email" name="email" defaultValue={user?.email} /></label>
        <label className="jlbl">Experience<input className="jfield" name="exp" placeholder="e.g. 2 years" /></label>
        <label className="jlbl">Expected salary (৳)<input className="jfield" type="number" name="salary" /></label>
      </div>
      <label className="jlbl">LinkedIn / portfolio (optional)<input className="jfield" name="link" placeholder="https://" /></label>
      <CvUpload cv={cv} onPick={onCv} onClear={() => setCv(null)} />
      <label className="jlbl">Cover note (optional)<textarea className="cr-note" name="note" rows={3} placeholder="Why are you a good fit?" /></label>
      {err && <span className="cr-err">{err}</span>}
      <button disabled={busy} className="btn btn-grad cr-submit">{busy ? 'Submitting…' : 'Submit application'}</button>
      <span className="cr-fine">Your details are only used for recruitment.</span>
    </form>
  );
}
