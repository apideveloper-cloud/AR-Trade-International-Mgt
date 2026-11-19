import { forwardRef } from 'react';

const HOW = [
  'উপরের মেনু বার থেকে আপনার কাংখিত প্রোডাক্টটির ক্যাটাগরি সিলেক্ট করুন।',
  'অথবা সার্চ অপশনে গিয়ে আপনার প্রোডাক্টটির নাম লিখে সার্চ করুন।',
  'আপনার কাংখিত প্রোডাক্টটি নির্বাচিত হলে “Add To Cart” বাটনে ক্লিক করুন।',
  'পেইজের উপরের ডানদিকে কোণায় আইকন ক্লিক করে আপনার নির্বাচিত পণ্যগুলি “Checkout” বাটনে ক্লিক করুন।',
  'আপনার সম্পর্কিত তথ্য পূরণ করুন কিংবা পূর্ববর্তী একাউন্টে লগইন করুন এবং “Place Order” বাটনে ক্লিক করুন।'
];

/** The Bangla "How to order" side block; `shown` starts its entrance animation. */
const HowToOrder = forwardRef(function HowToOrder({ shown }, ref) {
  return (
    <aside className={'howblock' + (shown ? ' in' : '')} ref={ref}>
      <div className="howto">
        <div className="howto-hd">
          <div>
            <h3><span>🛒</span>কিভাবে অর্ডার করবেন</h3>
            <p><b>মাত্র কয়েকটি স্টেপ ফলো করে খুব সহজেই আপনি আমাদের সাইটে অনলাইনে অর্ডার করতে পারেন।</b></p>
          </div>
          <div className="howto-side">
            <span className="hl-off"><b>অনলাইনে অর্ডার করলেই পাচ্ছেন ৫০০ টাকা ছাড় সহ নানা অফার।</b></span>
            <a className="howto-call" href="tel:+8801977554401"><span>☎</span><small>বিস্তারিত জানার জন্য আজই ফোন করুন</small><b>০১৯৭৭৫৫৪৪০১-০৭</b></a>
          </div>
        </div>
        <ol className="howto-steps">
          {HOW.map((t, i) => (
            <li key={i} data-n={i + 1} style={{ '--r': `${i * 2 + 1} / span 4` }}>
              <figure className="hs">
                <figcaption>{t}</figcaption>
                {(i === 4 ? ['5a', '5b'] : [String(i + 1)]).map(n => <img key={n} src={`/how/step-${n}.webp`} alt={`Step ${i + 1}: ${t}`} loading="lazy" width="960" />)}
              </figure>
            </li>
          ))}
          <li className="done" style={{ '--r': `${(HOW.length - 1) * 2 + 5}` }}><div className="fin"><i>✓</i><b>অর্ডার সম্পন্ন!</b><span>আমরা ফোন করে কনফার্ম করব এবং দ্রুত ডেলিভারি দেব।</span></div></li>
        </ol>
      </div>
    </aside>
  );
});

export default HowToOrder;
