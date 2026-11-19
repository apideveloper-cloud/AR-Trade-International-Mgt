// Writes the reply for a product search result.
import { taka } from './text.js';

const sellLine = (list, bn) => (list[0]
  ? (bn ? ' কার্ডে ট্যাপ করে বিস্তারিত দেখুন বা কার্টে যোগ করুন।' : ' Tap a card for details or add it to your cart.')
  : '');
const labelOf = ctx => [ctx.brand, ctx.tech, ctx.flags?.color ? 'colour' : ctx.flags?.mono ? 'mono' : '', ctx.flags?.wifi ? 'Wi-Fi' : '', ctx.flags?.multi ? 'multifunction' : '',
  { printer: 'printers', toner: 'toner', 'copier-toner': 'copier toner', ink: 'ink', copier: 'photocopiers', computer: 'computers', scanner: 'scanners', camera: 'security cameras', network: 'networking products', parts: 'spare parts' }[ctx.cat] || 'products'].filter(Boolean).join(' ');
const range = ctx => ctx.max === Infinity ? `above ${taka(ctx.min)}` : ctx.min ? `${taka(ctx.min)} to ${taka(ctx.max)}` : `up to ${taka(ctx.max)}`;

/** Reply text, product cards and context for a search result, in English or Bangla. */
export function productAnswer(u, found, bn, site) {
  const { ctx } = u, { list } = found;
  const items = list.map(p => ({ id: p.id, name: p.name, img: p.img, price: p.price, stock: p.stock, slug: p.slug }));
  const stock = p => (p.stock > 0 ? (bn ? 'স্টকে আছে' : 'in stock') : (bn ? 'এখন স্টকে নেই' : 'out of stock right now'));
  if (!list.length) {
    if (u.models.length) {
      const m = u.models.map(x => x.toUpperCase()).join(' ');
      return { text: bn ? `${m} মডেলের জন্য এই মুহূর্তে তালিকায় কিছু পাইনি। সঠিক প্রোডাক্ট নিশ্চিত করতে ${site.phone} নম্বরে কল বা WhatsApp করুন।`
        : `I could not find ${labelOf(ctx)} listed for ${m} on the site. Call or WhatsApp ${site.phone} with your printer model and the team will confirm the right one and today's price.`, items, ctx };
    }
    return { text: bn ? `এই মুহূর্তে এমন কোনো প্রোডাক্ট পাইনি। মডেল নম্বর বা বাজেট জানালে খুঁজে দেব, অথবা ${site.phone} নম্বরে কল করুন।`
      : `I could not find a match right now. Tell me the model number or your budget and I will look again, or call ${site.phone} and the team will source it for you.`, items, ctx };
  }
  if (found.exact) {
    const top = list[0];
    const text = list.length === 1
      ? (bn ? `${top.name}: ${top.price > 0 ? taka(top.price) : 'দাম জানতে কল করুন'}, ${stock(top)}।` : `${top.name}: ${top.price > 0 ? taka(top.price) : 'price on request'}, ${stock(top)}.${top.price > 0 ? '' : ` Call or WhatsApp ${site.phone} and we will quote it today.`}`)
      : (bn ? `${list.length}টি মিল পেয়েছি।` : `I found ${found.total} matching products. Here are the closest.`);
    return { text: text + sellLine(list, bn), items, ctx };
  }
  const nameList = list.map(p => `${p.name} (${p.price > 0 ? taka(p.price) : bn ? 'দাম জানতে কল করুন' : 'price on request'})`).join('; ');
  let text;
  if (list.every(p => !(p.price > 0))) {
    text = bn ? `এগুলো আছে: ${nameList}। এসব প্রোডাক্টের দাম আজকের কোটেশনে জানানো হয় — ${site.phone} নম্বরে কল বা WhatsApp করুন।`
      : `We have these ${labelOf(ctx)}: ${nameList}. Their prices are quoted per order, so call or WhatsApp ${site.phone} with the quantity and we will send today's price.`;
    return { text, items, ctx };
  }
  if (found.near) {
    const what = found.relaxed && found.relaxed.min == null && (ctx.min != null || ctx.max != null) ? 'budget' : 'wish';
    text = bn ? `হুবহু মিল পাইনি। কাছাকাছি: ${nameList}।`
      : what === 'budget' ? `I have nothing exactly in ${range(ctx)}, but these ${labelOf(found.relaxed)} are the closest in price: ${nameList}.`
        : `I do not have an exact match for that, but these ${labelOf(found.relaxed)} are close: ${nameList}.`;
  }
  else if (ctx.max != null || ctx.min != null) text = bn ? `আপনার বাজেটে ${found.total}টি প্রোডাক্ট আছে। সেরা কয়েকটি: ${nameList}।` : `I found ${found.total} ${labelOf(ctx)} in ${range(ctx)}. Best picks: ${nameList}.`;
  else if (ctx.sort === 'cheap') text = bn ? `সবচেয়ে কম দামের কয়েকটি: ${nameList}।` : `The lowest-priced ${labelOf(ctx)} in stock: ${nameList}.`;
  else text = bn ? `জনপ্রিয় কয়েকটি: ${nameList}।` : `Popular ${labelOf(ctx)} right now: ${nameList}.`;
  const ask = ctx.cat === 'printer' && !ctx.tech && !(ctx.flags?.color || ctx.flags?.mono)
    ? (bn ? ' বাসার জন্য নাকি অফিসের? মাসে কত পাতা প্রিন্ট হবে এবং কালার লাগবে কিনা জানালে আরও ভালো বেছে দিতে পারব।' : ' Is it for home or office, and do you need colour? Tell me and I will narrow it down.')
    : (bn ? '' : ' What is your budget? I will narrow it down.');
  return { text: text + sellLine(list, bn) + (found.near ? '' : ask), items, ctx };
}
