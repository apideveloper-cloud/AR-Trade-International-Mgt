import { registerDict } from '../lang.jsx';

// Top-level admin pages: Dashboard, Product report, Role matrix page, Content manager, Backups summary.
registerDict({
  // ---- Backups
  'automatic · {size}': 'স্বয়ংক্রিয় · {size}',
  'manual · {size}': 'ম্যানুয়াল · {size}',
  'press Back up now': '"এখনই ব্যাকআপ" চাপুন',
  'every {n} hours': 'প্রতি {n} ঘণ্টায়',
  'Disk used': 'ডিস্ক ব্যবহার',
  '{n} copies · kept {d} days': '{n}টি কপি · {d} দিন রাখা হয়',
  'How to restore a backup': 'ব্যাকআপ কীভাবে ফিরিয়ে আনবেন',
  'Restoring replaces the data, so it is done on the server, with the site stopped, and never by accident from this page. Keep a fresh backup first.': 'ব্যাকআপ ফিরিয়ে আনলে বর্তমান তথ্য বদলে যায়, তাই এটি সার্ভারে সাইট বন্ধ রেখে করা হয়, এই পেজ থেকে ভুলে নয়। আগে একটি নতুন ব্যাকআপ রেখে নিন।',
  "Backups sit in <b>{dir}</b> next to the website's own files. For safety against a disk failure, download one regularly and keep it somewhere else.": "ব্যাকআপ <b>{dir}</b> ফোল্ডারে ওয়েবসাইটের নিজের ফাইলের পাশেই থাকে। ডিস্ক নষ্ট হলে যেন বিপদ না হয়, তাই নিয়মিত একটি ডাউনলোড করে অন্য কোথাও রাখুন।",

  // ---- Product report
  'Product report': 'পণ্যের রিপোর্ট',
  'Open Products': 'পণ্য খুলুন',
  'Open Orders': 'অর্ডার খুলুন',
  'no earlier data': 'আগের তথ্য নেই',
  '{n}% vs the period before': 'আগের সময়ের তুলনায় {n}%',
  'Units sold per day': 'প্রতিদিন বিক্রি হওয়া সংখ্যা',
  '{d}: {q} sold': '{d}: {q}টি বিক্রি',
  'max {n}/day': 'সর্বোচ্চ {n}/দিন',
  'Hidden from store': 'দোকান থেকে লুকানো',
  'SKU {sku}': 'SKU {sku}',
  'All time: {units} sold · {money} · {n} order': 'সব সময়: {units}টি বিক্রি · {money} · {n}টি অর্ডার',
  'All time: {units} sold · {money} · {n} orders': 'সব সময়: {units}টি বিক্রি · {money} · {n}টি অর্ডার',
  'Units sold': 'বিক্রি হওয়া সংখ্যা',
  'Rank': 'র‍্যাঙ্ক',
  'avg {money} per unit': 'প্রতিটি গড়ে {money}',
  'of {n} selling products': '{n}টি বিক্রিত পণ্যের মধ্যে',
  'no sales in this period': 'এই সময়ে কোনো বিক্রি নেই',
  'Not sold {when}. {n} unit (about {money}) are tied up on the shelf: consider a discount, a bundle or a campaign.': 'পণ্যটি {when} বিক্রি হয়নি। {n}টি (প্রায় {money}) তাকে পড়ে আছে: ছাড়, বান্ডেল বা ক্যাম্পেইনের কথা ভাবুন।',
  'Not sold {when}. {n} units (about {money}) are tied up on the shelf: consider a discount, a bundle or a campaign.': 'পণ্যটি {when} বিক্রি হয়নি। {n}টি (প্রায় {money}) তাকে পড়ে আছে: ছাড়, বান্ডেল বা ক্যাম্পেইনের কথা ভাবুন।',
  'Not sold {when}, and nothing is in stock.': 'পণ্যটি {when} বিক্রি হয়নি, আর স্টকেও কিছু নেই।',
  'Selling, but out of stock. Reorder first.': 'বিক্রি হচ্ছে, কিন্তু স্টক নেই। আগে আবার অর্ডার করুন।',
  'At the speed of the last 30 days ({sold} sold) the stock lasts about {n} day. Reorder soon.': 'গত ৩০ দিনের বিক্রির গতিতে ({sold}টি বিক্রি) স্টক প্রায় {n} দিন চলবে। শিগগিরই আবার অর্ডার করুন।',
  'At the speed of the last 30 days ({sold} sold) the stock lasts about {n} days. Reorder soon.': 'গত ৩০ দিনের বিক্রির গতিতে ({sold}টি বিক্রি) স্টক প্রায় {n} দিন চলবে। শিগগিরই আবার অর্ডার করুন।',
  'Stock covers about {n} days at the speed of the last 30 days.': 'গত ৩০ দিনের বিক্রির গতিতে স্টক প্রায় {n} দিন চলবে।',
  'last 14 days': 'গত ১৪ দিন',
  'Latest orders': 'সাম্প্রতিক অর্ডার',
  'newest first': 'নতুন আগে',
  'No sales in this window.': 'এই সময়ে কোনো বিক্রি নেই।',
  'This product has not been ordered yet.': 'এই পণ্যের এখনো কোনো অর্ডার হয়নি।',

  // ---- Role matrix page
  'Role matrix': 'ভূমিকার ম্যাট্রিক্স',
  "Tick what each role may do. <u>Master Admin</u> always has full access and is the only role that can open this page. <u>Admin</u> has limited access: exactly the ticks you set below. Changes apply on the person's next click, no sign-out needed.": "প্রতিটি ভূমিকা কী করতে পারবে তা টিক দিন। <u>মাস্টার অ্যাডমিন</u> সবসময় পূর্ণ অধিকার পান এবং শুধু তিনিই এই পেজ খুলতে পারেন। <u>অ্যাডমিনের</u> সীমিত অধিকার: নিচে আপনি যা টিক দেবেন ঠিক তা-ই। পরিবর্তন ওই ব্যক্তির পরের ক্লিক থেকেই কার্যকর হয়, সাইন আউট লাগে না।",
  'Show existing roles': 'আগের ভূমিকাগুলো দেখান',
  '{n} role with unsaved changes: {names}': '{n}টি ভূমিকায় অসংরক্ষিত পরিবর্তন: {names}',
  '{n} roles with unsaved changes: {names}': '{n}টি ভূমিকায় অসংরক্ষিত পরিবর্তন: {names}',
  'No unsaved changes.': 'কোনো অসংরক্ষিত পরিবর্তন নেই।',
  'Save role matrix': 'ভূমিকার ম্যাট্রিক্স সংরক্ষণ করুন',
  'Recent changes': 'সাম্প্রতিক পরিবর্তন',
  'No changes yet.': 'এখনো কোনো পরিবর্তন নেই।',

  // ---- Content manager
  'Saved. The website shows it immediately.': 'সংরক্ষিত হয়েছে। ওয়েবসাইটে এখনই দেখা যাবে।',
  'Changes go live on the website as soon as you save.': 'সংরক্ষণ করলেই পরিবর্তন ওয়েবসাইটে চালু হয়ে যায়।',
  'Images are stored in the <u>uploads/site</u> folder.': 'ছবিগুলো <u>uploads/site</u> ফোল্ডারে জমা হয়।'
});
