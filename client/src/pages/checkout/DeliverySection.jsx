import { lazy, Suspense } from 'react';
import { fmt } from '../../api.js';
import DistrictCombo from '../../components/DistrictCombo.jsx';
import { DHAKA_THANAS, DISTRICTS, partnerLogo } from '../../data.js';
import { toAsciiDigits } from '../../phone.js';
import { sel } from './constants.js';
import DeliveryMethod from './DeliveryMethod.jsx';

const DeliveryMap = lazy(() => import('../../components/DeliveryMap.jsx'));

/** Courier choice for orders outside Dhaka. */
function PartnerPicker({ c }) {
  const { f, dl, site, partner, setPartner, codOn } = c;
  return (
    <div id="co-partner" tabIndex={-1} className="co-partner">
      <span className="ct-label13">Shipping partner <i className="req" aria-hidden="true">*</i></span>
      <div className="two ct-two-180" role="radiogroup" aria-label="Shipping partner">
        {dl.partners.map(p => (
          <button type="button" key={p.id} role="radio" aria-checked={partner === p.id} className={sel(partner === p.id)} onClick={() => { setPartner(p.id); f.clr('partner'); }}>{partnerLogo(p.id) && <span className="pt-logo"><img src={partnerLogo(p.id)} alt="" loading="lazy" /></span>}<span className="ct-zone-t">{p.name}</span></button>
        ))}
      </div>
      {f.fe('partner')}
      <small className="dm-hint">Delivery charge {fmt(site.outsideFee)} · courier, 2–4 days · we will confirm your parcel with the partner</small>
      {codOn && <span className="cod-pill">✓ Cash on delivery available</span>}
    </div>
  );
}

/** Checkout step 2: address, district, thana, map or courier, delivery method and note. `c` is the checkout context (see CheckoutPage). */
export default function DeliverySection({ c }) {
  const { f, defaults, district, pickDistrict, dest, setDest, dl, area } = c;
  const { errs, clr, fe, bad } = f;
  const dhaka = district === 'Dhaka';
  return (
    <div className="cardbox2">
      <div className="co-h"><i>2</i><div><b>Delivery</b><small>Choose your area, speed and address</small></div></div>
      <div className="two co-addr">
        <label className="lbl co-wide"><span>Address <i className="req" aria-hidden="true">*</i></span><input type="text" className={'field2' + bad('address')} name="address" required aria-required="true" aria-invalid={!!errs.address} aria-describedby={errs.address ? 'err-address' : undefined} maxLength={150} placeholder="House / flat, road, area" autoComplete="street-address" defaultValue={defaults.address} onChange={() => clr('address')} />{fe('address')}</label>
        <label className="lbl"><span>Postcode <span className="lbl-opt">(optional)</span></span><input className={'field' + bad('postcode')} name="postcode" aria-invalid={!!errs.postcode} aria-describedby={errs.postcode ? 'err-postcode' : undefined} inputMode="numeric" maxLength={4} autoComplete="postal-code" placeholder="e.g. 1217" defaultValue={defaults.postcode} onChange={e => { e.target.value = toAsciiDigits(e.target.value).replace(/\D/g, '').slice(0, 4); clr('postcode'); }} />{fe('postcode')}</label>
        <div className="lbl"><label htmlFor="co-district-in"><span>District <i className="req" aria-hidden="true">*</i></span></label>
          <DistrictCombo id="co-district-in" name="district" value={district} options={DISTRICTS} invalid={!!errs.district} describedBy={errs.district ? 'err-district' : undefined} onChange={pickDistrict} />
          {fe('district')}
        </div>
        {district === 'Others' && (
          <label className="lbl co-wide co-other"><span>Type your district <i className="req" aria-hidden="true">*</i></span>
            <input className={'field' + bad('districtOther')} name="districtOther" required aria-required="true" aria-invalid={!!errs.districtOther} aria-describedby={errs.districtOther ? 'err-districtOther' : undefined} autoFocus maxLength={40} autoComplete="address-level2" placeholder="Your district, e.g. Sherpur" defaultValue={defaults.districtOther} onChange={() => clr('districtOther')} />
            {fe('districtOther')}
          </label>
        )}
        <label className="lbl"><span>Thana <i className="req" aria-hidden="true">*</i></span><input className={'field' + bad('thana')} name="thana" required aria-required="true" aria-invalid={!!errs.thana} aria-describedby={errs.thana ? 'err-thana' : undefined} list={dhaka ? 'thana-dhaka' : undefined} maxLength={40} autoComplete="off" placeholder={dhaka ? 'Pick or type, e.g. Mirpur' : 'Thana / upazila'} defaultValue={defaults.thana} onChange={() => clr('thana')} />{fe('thana')}</label>
        {dhaka && <datalist id="thana-dhaka">{DHAKA_THANAS.map(x => <option key={x} value={x} />)}</datalist>}
      </div>
      {!district && <div className="dm-hint" id="co-delivery-hint">Select your district above to see delivery options</div>}
      {dhaka && (
        <div id="co-dest" tabIndex={-1} className="co-dest">
          <Suspense fallback={<div className="dm-hint">Loading map…</div>}>
            <DeliveryMap office={dl.office} freeKm={dl.freeKm} label={dl.office.label} value={dest} invalid={!!errs.dest} onChange={q => { setDest(q); if (q) clr('dest'); }} />
          </Suspense>
          {fe('dest')}
        </div>
      )}
      {!!district && !dhaka && <PartnerPicker c={c} />}
      {area === 'inside' && !!district && <DeliveryMethod c={c} />}
      <label className="lbl">Order note (optional)<input className="field2" name="note" placeholder="e.g. Printer model, floor / office name" defaultValue={defaults.note} /></label>
    </div>
  );
}
