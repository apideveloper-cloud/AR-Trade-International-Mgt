import { fmt } from '../../api.js';

const PERKS = [['৳', 'Free cash on delivery', 'Pay when it arrives in Dhaka', 150], ['✓', 'Satisfaction guarantee', 'Genuine, warranty-backed stock', 250], ['5%', 'Online order discount', '5% off, applied at checkout', 30]];

/** Delivery summary and the three perk cards (the `--h` variable staggers their animation). */
export default function DeliveryPerks({ site }) {
  return (
    <>
      <div className="deliv">
        <div><i>🚚</i><span><b>Inside Dhaka</b><span>Order before 2 PM for same-day delivery · cash on delivery</span></span></div>
        <div><i>📦</i><span><b>Outside Dhaka</b><span>Courier in 1–3 working days · {fmt(site.outsideFee)}</span></span></div>
      </div>
      <div className="perks3">
        {PERKS.map(([i, t, d, h]) => <div key={t} style={{ '--h': h }}><i>{i}</i><b>{t}</b><span>{d}</span></div>)}
      </div>
    </>
  );
}
