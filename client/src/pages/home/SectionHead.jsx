/** Kicker + title on the left, optional controls (tabs, link) on the right. */
export default function SectionHead({ kick, title, children }) {
  return (
    <div className="sec-hd">
      <div className="hm-sec-title"><span className="kicker">{kick}</span><h2 className="h2 hm-sec-h2">{title}</h2></div>
      {children}
    </div>
  );
}
