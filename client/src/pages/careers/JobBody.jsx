/** About / responsibilities / requirements / benefits card. */
export default function JobBody({ j }) {
  return (
    <div className="cr-body">
      <p className="cr-about">{j.about}</p>
      <div className="cr-sec"><b className="cr-sec-h">What you'll do</b>{j.resp.map(r => <span key={r} className="cr-li"><span className="cr-mark">✓</span>{r}</span>)}</div>
      <div className="cr-sec"><b className="cr-sec-h">What we're looking for</b>{j.req.map(r => <span key={r} className="cr-li"><span className="cr-mark">•</span>{r}</span>)}</div>
      {j.perks.length > 0 && <div className="cr-sec"><b className="cr-sec-h">Benefits</b><div className="cr-perks">{j.perks.map(r => <span key={r} className="cr-perk">{r}</span>)}</div></div>}
    </div>
  );
}
