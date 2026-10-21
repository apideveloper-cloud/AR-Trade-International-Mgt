(function () {
  const U = 'https://artradeinternational.com/wp-content/uploads/';
  const KEY = 'ar_store_v1';
  const DAY = 864e5;
  const fmt = n => '৳ ' + Math.round(n || 0).toLocaleString('en-US');

  const CATS = [
    { id: 'toner', t: 'Toner & Cartridge', d: 'Original laser toner' },
    { id: 'copier-toner', t: 'Copier Toner', d: 'Toshiba, Canon, Sharp' },
    { id: 'ink', t: 'Ink & Bottles', d: 'HP, Canon, Epson ink' },
    { id: 'printer', t: 'Printers', d: 'Laser, inkjet, plotter' },
    { id: 'copier', t: 'Photocopiers', d: 'Multifunction copiers' },
    { id: 'computer', t: 'Computers', d: 'Desktop, laptop, monitor' },
    { id: 'scanner', t: 'Scanners', d: 'HP, Canon, Epson' },
    { id: 'camera', t: 'Security Camera', d: 'IP, Wi-Fi, DVR / NVR' },
    { id: 'network', t: 'Networking', d: 'Router, switch, cable' },
    { id: 'parts', t: 'Spare Parts', d: 'Printer & copier parts' }
  ];

  const P = [];
  function add(id, cat, brand, name, old, price, img, o) {
    const p = Object.assign({ id, cat, brand, name, old, price, img: img ? U + img : null, stock: 18, popular: false, isNew: false, active: true, tech: '', color: '', yield: '', part: '', compat: '', extra: [] }, o || {});
    p.spec = p.spec || [p.yield, p.color].filter(Boolean).join(' · ');
    P.push(p);
  }
  const L = 'Laser', I = 'Inkjet', C = 'Copier';
  add(3161, 'toner', 'HP', 'HP 79A Black Original LaserJet Toner (CF279A)', 10200, 8300, '2018/09/hp-79a-black-toner.jpg', { part: 'CF279A', tech: L, color: 'Black', yield: '~1,000 pages', compat: 'HP LaserJet Pro M12a, M12w, MFP M26a, MFP M26nw', popular: true, stock: 34 });
  add(5460, 'toner', 'HP', 'HP 56X High Yield Black LaserJet Toner (CF256X)', 8200, 7200, '2019/02/HP-56X-High-Yield-Black-Original-LaserJet-Toner.jpg', { part: 'CF256X', tech: L, color: 'Black', yield: 'High yield', compat: 'HP LaserJet M436n, M436nda, M436dn', popular: true });
  add(8506, 'toner', 'HP', 'HP 107A Black Original LaserJet Toner (W1107A)', 6800, 5900, '2020/06/hp-107a-toner-price.jpg', { part: 'W1107A', tech: L, color: 'Black', yield: '~1,000 pages', compat: 'HP Laser 100 series, HP Laser MFP 130 series', popular: true, stock: 41 });
  add(14920, 'toner', 'HP', 'HP 151A Black Original LaserJet Toner (W1510A)', 15100, 12900, '2022/11/151a-black-01-500x5001-1.webp', { part: 'W1510A', tech: L, color: 'Black', yield: '~3,050 pages', compat: 'HP LaserJet Pro 4003, 4103', popular: true });
  add(3111, 'toner', 'HP', 'HP 26A Black Original LaserJet Toner (CF226A)', 16000, 14800, '2018/09/HP-26A-Black-Original-LaserJet-Toner.jpg', { part: 'CF226A', tech: L, color: 'Black' });
  add(3123, 'toner', 'HP', 'HP 17A Black Original LaserJet Toner (CF217A)', 8800, 7900, '2018/09/HP-17A-Black-Original-LaserJet-Toner-Cartridge.jpg', { part: 'CF217A', tech: L, color: 'Black' });
  add(3101, 'toner', 'Canon', 'Canon EP-312 Black Original Toner Cartridge', 9400, 8700, '2018/09/CART-312-500x500.jpg', { part: 'EP-312', tech: L, color: 'Black', yield: '~1,500 pages' });
  add(19136, 'toner', 'Canon', 'Canon 071 Black Original Toner', 5500, 5350, '2024/11/canon-071-black.webp', { part: '071', tech: L, color: 'Black', yield: '~1,200 pages', isNew: true });
  add(10913, 'toner', 'HP', 'HP 131A CMYK Original LaserJet Toner — Full Set', 43900, 38800, '2021/02/hp-131-toner.jpg', { part: 'CF210A–CF213A', tech: L, color: 'CMYK', yield: '~1,800 pages', popular: true });
  add(10917, 'toner', 'HP', 'HP 508A CMYK Original LaserJet Toner — Full Set', 106000, 91000, '2021/02/HP-508-TONER....jpg', { part: 'CF360A–CF363A', tech: L, color: 'CMYK', yield: 'K 6,000 · CMY 5,000 pages' });
  add(11003, 'toner', 'HP', 'HP 410A CMYK Original LaserJet Toner — Full Set', 63300, 53500, '2021/02/Hp-410-toner..jpg', { tech: L, color: 'CMYK', yield: '~9,200 pages', popular: true });
  add(5450, 'toner', 'HP', 'HP 416A CMYK Original Full Set Toner (W2040A)', 59800, 54800, '2019/02/hp-416a-full-set-toner.jpg', { part: 'W2040A', tech: L, color: 'CMYK', compat: 'HP Color LaserJet M454dn, M454dw, M479dw, M479fdw, M479fnw', popular: true, featured: true });
  add(15853, 'toner', 'HP', 'HP 206A CMYK Full-Set LaserJet Toner', 40150, 37000, '2023/02/HP-206A-CMYK-Full-Set.jpg', { tech: L, color: 'CMYK' });
  add(15854, 'toner', 'HP', 'HP 212A CMYK Full-Set LaserJet Toner', 104000, 94500, '2023/02/HP-212A-CMYK-Full-Set.jpg', { tech: L, color: 'CMYK' });
  add(15857, 'toner', 'HP', 'HP 307A CMYK Full-Set LaserJet Toner', 140000, 132500, '2023/02/HP-307A-CMYK-Full-Set.jpg', { tech: L, color: 'CMYK', stock: 3 });
  add(15861, 'toner', 'HP', 'HP 415A CMYK Original LaserJet Toner', 59500, 53500, '2023/02/HP-415A-CMYK-Full-Set.jpg', { tech: L, color: 'CMYK' });
  add(20534, 'toner', 'HP', 'HP 230A CMYK Toner Cartridge Full Set', 60000, 56900, 'Untitled-design-5-1.png', { tech: L, color: 'CMYK', yield: 'K 1,300 · CMY 1,200 pages', compat: 'HP Color LaserJet Pro 4203dn, 4203dw, 4303fdw, MFP 4303dw', popular: true });
  add(20470, 'toner', 'HP', 'HP 222A CMYK Full Set Original LaserJet Toner', 50500, 42200, 'HP-222A-CMYK-Full-Set-Original-LaserJet-Toner-Cartridges.jpg', { tech: L, color: 'CMYK', isNew: true });
  add(18642, 'toner', 'HP', 'HP 650A CMYK Full Set Original Toner', 160000, 155000, '2024/08/hp-650A.png', { part: 'CE270A–CE273A', tech: L, color: 'CMYK', yield: 'K 13,500 pages', compat: 'HP CP5525dn, CP5525n, CP5525xh, M750dn, M750n' });
  add(18638, 'toner', 'Canon', 'Canon 322 CMYK Original Laser Toner — Full Set', 130000, 124500, '2024/08/322-toner-600x600-1.png', { tech: L, color: 'CMYK', yield: '~7,500 pages', compat: 'Canon LBP 9100C, 9200C, 9500C, 9600C' });
  add(18650, 'toner', 'HP', 'HP 659X High-Yield CMYK Original LaserJet Toner Set', 0, 0, '2024/08/HP-659X-CMYK-Multipack-High-Capacity-Toner-Cartridge.jpg', { tech: L, color: 'CMYK', yield: 'K 34,000 · CMY 29,000 pages' });
  add(18910, 'toner', 'HP', 'HP 651A CMYK Original Laser Toner Cartridge', 0, 0, '2024/11/HP-651A.png', { tech: L, color: 'CMYK', yield: 'CMY 16,000 · K 13,500 pages', isNew: true });

  add(7622, 'ink', 'HP', 'HP 72 130-ml Matte Black DesignJet Ink (C9403A)', 13500, 12500, '2020/04/Hp-72-black-1.jpg', { part: 'C9403A', tech: I, color: 'Matte Black', yield: '130 ml', popular: true });
  add(16159, 'ink', 'HP', 'HP 728B 300-ml Matte Black DesignJet Ink (F9J67A)', 22500, 20500, '2023/02/HP-728B-Matte-Black.jpg', { part: 'F9J67A', tech: I, color: 'Matte Black', yield: '300 ml' });
  add(12685, 'ink', 'HP', 'HP 712 Cyan Original Ink Cartridge (3ED67A)', 4500, 4000, '2021/09/Hp-712-Cyan-ink-Cartridge1.jpg', { part: '3ED67A', tech: I, color: 'Cyan', yield: '29 ml' });
  add(11110, 'ink', 'Canon', 'Canon PFI-8107 Black Ink Tank Cartridge', 10300, 9800, '2021/02/Canon-8107-Black.jpg', { part: '6710B001AA', tech: I, color: 'Black', yield: '130 ml' });
  add(11120, 'ink', 'Canon', 'Canon PFI-8107 Cyan Ink Tank Cartridge', 10300, 9800, '2021/02/canon-8107-Cyan-.jpg', { part: '6711B001AA', tech: I, color: 'Cyan', yield: '130 ml' });
  add(18884, 'ink', 'Epson', 'Epson 057 Full Set Original Ink Bottle', 8400, 7800, '2024/09/057-full-set.jpg', { tech: I, color: '6 colours', isNew: true });
  add(19134, 'ink', 'Canon', 'Canon GI-71 CMYK Full Set Ink Bottle', 6000, 5850, '2024/11/canon-gi-71-cmyk.png', { tech: I, color: 'CMYK', yield: '~7,000 pages', isNew: true });
  add(18920, 'ink', 'HP', 'HP 981X High Yield Cyan PageWide Cartridge', 0, 0, '2024/11/cyan.png', { tech: 'PageWide', color: 'Cyan', yield: '~10,000 pages', isNew: true });

  add(4671, 'copier-toner', 'Toshiba', 'Toshiba T-5018P Original Photocopier Toner', 12500, 10800, '2018/12/Toshiba-5018P-Photocopier-toner.jpg', { tech: C, color: 'Black', popular: true, stock: 22 });
  add(4792, 'copier-toner', 'Toshiba', 'Toshiba T-3008P Original Photocopier Toner', 11000, 9000, '2018/12/Toshiba-T-3008P-2.png', { tech: C, color: 'Black', popular: true });
  add(4734, 'copier-toner', 'Sharp', 'Sharp MX-237AT Black Original Toner', 9000, 7800, '2018/12/Sharp-MX-237AT-Black-Toner.png', { tech: C, color: 'Black', popular: true });
  add(10921, 'copier-toner', 'Canon', 'Canon NPG-67 CMYK Full Set Toner', 62500, 58000, '2021/02/canon-npg-67-toner-cartridge..jpg', { tech: C, color: 'CMYK', stock: 2, popular: true });
  add(15903, 'copier-toner', 'Toshiba', 'Toshiba T-FC415P CMYK Original Toner', 47500, 42500, '2023/02/Toshiba-T-FC415P-CMYK-v1.jpg', { tech: C, color: 'CMYK' });
  add(15904, 'copier-toner', 'Toshiba', 'Toshiba T3028C Black Original Toner', 8300, 7200, '2023/02/Toshiba-T-3028C-Toner.jpg', { tech: C, color: 'Black' });

  const pr = (sp, con, duty, mem) => [['Print speed', sp], ['Connectivity', con], ['Duty cycle', duty], ['Processor / memory', mem]];
  add(18965, 'printer', 'Pantum', 'Pantum CP1100DW Color Laser Printer', 40000, 39000, '2024/10/cp1100-01-500x500-1.png', { tech: 'Colour laser', spec: '18 ppm · Wi-Fi · Duplex', isNew: true, extra: pr('18 ppm', 'USB, Network, Wi-Fi', '30,000 pages', '1 GHz / 1 GB') });
  add(18964, 'printer', 'Pantum', 'Pantum BP5100DW Mono Laser, Duplex & Wi-Fi', 32000, 31200, '2024/10/bm5100adw-01-500x500-1.png', { tech: 'Mono laser', spec: 'Auto duplex · Wi-Fi', isNew: true, extra: pr('—', 'USB 2.0, Network, Wi-Fi', '100,000 pages', '1200 MHz / 512 MB') });
  add(18963, 'printer', 'Pantum', 'Pantum M7105DW Mono Laser Multifunction', 30000, 28800, '2024/10/m7105dw-01-500x500-1.png', { tech: 'Mono laser MFP', spec: 'Print · Copy · Scan · 33 ppm', isNew: true, extra: pr('33 ppm', 'USB, Network, Wi-Fi', '80,000 pages', '—') });
  add(18962, 'printer', 'Pantum', 'Pantum BP5100DN Single Function Mono Laser', 24000, 23000, '2024/10/bp5100dn-01-500x500-1.png', { tech: 'Mono laser', spec: 'Auto duplex · Network', extra: pr('—', 'USB 2.0, Network', '100,000 pages', '1200 MHz / 512 MB') });
  add(18961, 'printer', 'Pantum', 'Pantum P3305DW Mono Laser Printer', 24000, 22500, '2024/10/p3305dw-01-500x500-1.png', { tech: 'Mono laser', spec: '33 ppm · Wi-Fi · Duplex', isNew: true, extra: pr('33 ppm', 'USB, Network, Wi-Fi', '80,000 pages', '—') });
  add(18960, 'printer', 'Pantum', 'Pantum M6700DW Mono Laser Multifunction', 21000, 20000, '2024/10/m6700dw-01-500x500-1.png', { tech: 'Mono laser MFP', spec: 'Wi-Fi · Auto duplex', extra: pr('—', 'USB 2.0, Network, Wi-Fi', '60,000 pages', '525 MHz / 128 MB') });
  add(17001, 'printer', 'HP', 'HP DesignJet Studio Steel 36" Large Format Plotter', 374000, 340000, null, { tech: 'Large format', spec: '36-inch plotter', stock: 2 });
  add(17002, 'printer', 'HP', 'HP DesignJet Z3200 Photo Printer', 358000, 352000, null, { tech: 'Large format', spec: 'Photo production', stock: 1 });
  add(17101, 'copier', 'Ricoh', 'Ricoh IM C2500 Colour Multifunction Photocopier', 660000, 610000, null, { tech: 'Colour copier', spec: 'Print · Copy · Scan', stock: 2 });
  add(17102, 'copier', 'Sharp', 'Sharp BP-30M35 Digital Multifunction Photocopier', 382000, 354000, null, { tech: 'Mono copier', spec: '35 ppm · MFP', stock: 3 });
  add(17201, 'camera', 'Avtech', 'Avtech DGD-1008 8-Channel DVR', 10000, 9700, null, { tech: 'DVR', spec: '8 channel', stock: 9 });

  const STATUSES = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];
  const SVC_STATUSES = ['New', 'Scheduled', 'In progress', 'Completed'];
  const DEMO_USER = { name: 'Shakil Ahmed', phone: '01711-223344', email: 'shakil@example.com', address: 'House 12, Road 4, Shantinagar, Dhaka-1217', area: 'inside', since: '2024' };

  function seed() {
    const now = Date.now();
    const C = [
      DEMO_USER,
      { name: 'Nusrat Jahan', phone: '01819-554120', email: 'nusrat@brightpath.org', address: 'Gulshan-2, Dhaka', area: 'inside' },
      { name: 'Tanvir Hasan', phone: '01552-778899', email: 'tanvir@apsgroup.com.bd', address: 'Agrabad, Chattogram', area: 'outside' },
      { name: 'Farhana Akter', phone: '01912-336655', email: 'farhana@gmail.com', address: 'Mirpur-10, Dhaka', area: 'inside' },
      { name: 'Kamal Hossain', phone: '01675-202020', email: 'kamal@trimco.com', address: 'Uttara Sector 7, Dhaka', area: 'inside' },
      { name: 'Rafiq Islam', phone: '01716-909080', email: 'rafiq@csrm.edu.bd', address: 'Zindabazar, Sylhet', area: 'outside' }
    ];
    const pick = id => P.find(p => p.id === id);
    const spec = [
      [0, 0.2, [[5450, 1]], 'Pending', 'COD'], [1, 0.6, [[4671, 2], [4792, 1]], 'Confirmed', 'bKash'],
      [2, 1.2, [[18965, 1]], 'Packed', 'Nagad'], [3, 1.8, [[8506, 3]], 'Shipped', 'COD'],
      [0, 6, [[3161, 2], [7622, 1]], 'Delivered', 'COD'], [4, 2.5, [[10921, 1]], 'Delivered', 'Bank'],
      [5, 3.3, [[15903, 1], [15904, 2]], 'Shipped', 'bKash'], [1, 4.1, [[20534, 1]], 'Delivered', 'COD'],
      [3, 4.8, [[19134, 2], [18884, 1]], 'Cancelled', 'COD'], [4, 5.5, [[18963, 1]], 'Delivered', 'Upay'],
      [2, 6.2, [[14920, 2]], 'Delivered', 'Nagad'], [0, 21, [[19136, 1]], 'Delivered', 'bKash']
    ];
    const orders = spec.map((s, i) => {
      const c = C[s[0]]; const at = now - s[1] * DAY;
      const items = s[2].map(([id, qty]) => { const p = pick(id); return { id, qty, price: p.price, name: p.name, img: p.img }; });
      const subtotal = items.reduce((a, b) => a + b.price * b.qty, 0);
      const delivery = c.area === 'inside' ? 0 : 150;
      const idx = STATUSES.indexOf(s[3]);
      const history = s[3] === 'Cancelled' ? [{ s: 'Pending', at }, { s: 'Cancelled', at: at + 3 * 36e5 }] : STATUSES.slice(0, idx + 1).map((st, j) => ({ s: st, at: at + j * 5 * 36e5 }));
      return { id: 'AR-' + (10480 - i * 7), date: at, customer: { name: c.name, phone: c.phone, email: c.email }, area: c.area, address: c.address, items, subtotal, discount: 0, delivery, total: subtotal + delivery, payment: s[4], status: s[3], history, note: '' };
    });
    const services = [
      { id: 'SV-2091', type: 'Printer servicing', name: 'Shakil Ahmed', phone: DEMO_USER.phone, model: 'HP LaserJet Pro M12w', issue: 'Paper jam, faded print', date: new Date(now + 2 * DAY).toISOString().slice(0, 10), status: 'Scheduled', created: now - 1 * DAY },
      { id: 'SV-2088', type: 'Photocopier servicing', name: 'Kamal Hossain', phone: '01675-202020', model: 'Toshiba e-Studio 2508A', issue: 'Lines on copies', date: new Date(now + 1 * DAY).toISOString().slice(0, 10), status: 'New', created: now - 0.3 * DAY },
      { id: 'SV-2084', type: 'Computer servicing', name: 'Nusrat Jahan', phone: '01819-554120', model: 'Dell OptiPlex 3080', issue: 'Slow boot, OS reinstall', date: new Date(now - 1 * DAY).toISOString().slice(0, 10), status: 'In progress', created: now - 3 * DAY },
      { id: 'SV-2079', type: 'Printer servicing', name: 'Farhana Akter', phone: '01912-336655', model: 'Canon LBP 6030', issue: 'Not detected over USB', date: new Date(now - 4 * DAY).toISOString().slice(0, 10), status: 'Completed', created: now - 6 * DAY }
    ];
    return {
      v: 2, cart: {}, wish: [3161, 18965], compare: [], accounts: [{ name: 'Shakil Ahmed', phone: '01711000000', email: 'demo@artrade.com', pass: 'demo123', area: 'inside', address: 'House 12, Road 4, Shantinagar, Dhaka', since: '2023' }], admins: [{ name: 'AR Admin', email: 'admin@artradeinternational.com', phone: '01700000000', pass: 'admin123', role: 'Super admin', status: 'Active', at: Date.now() }], adminUser: null, user: null, orders, services, edits: {}, extra: [], messages: [], subscribers: [],
      settings: { promo: 'ধামাকা অফার! সব প্রোডাক্টে আকর্ষণীয় ছাড় · ঢাকা শহরে ক্যাশ অন ডেলিভারি · সারাদেশে দ্রুত হোম ডেলিভারি · রেজিস্ট্রেশন করে পরবর্তী অর্ডারে ১০% ডিস্কাউন্ট', showPromo: true, insideFee: 0, outsideFee: 150, coupon: 'ONLINE5', couponPct: 5, phone: '+880 1977-554401', email: 'info@artradeinternational.com', address: '159, Santinagar, Dhaka-1217', whatsapp: '8801977554401',
        heroTitle: 'Genuine toner. Reliable printers. Office tech that just works.', heroSub: "Original HP, Canon, Toshiba & Sharp supplies at Dhaka's sharpest prices — with cash on delivery and same-day dispatch in the city.",
        offerTitle: '5% off your first online order. 10% off the next.', offerSub: 'Create an account and use code ONLINE5 at checkout. Limited time.',
        hiddenCats: [], payments: { COD: true, bKash: true, Nagad: true, Upay: true, Bank: true },
        svcPrices: [
          { t: 'Laser / inkjet / dot printer servicing (inside Dhaka)', bn: 'লেজার, ইঙ্কজেট, ডটমেট্রিক্স প্রিন্টার সার্ভিসিং (ঢাকা শহরের মধ্যে)', reg: 1500, offer: 1000 },
          { t: 'Colour laser printer servicing (inside Dhaka)', bn: 'কালার লেজার প্রিন্টার সার্ভিসিং (ঢাকা শহরের মধ্যে)', reg: 2000, offer: 1500 },
          { t: 'Any printer servicing (outside Dhaka)', bn: 'যেকোন প্রিন্টার সার্ভিসিং (ঢাকা শহরের বাহিরে)', reg: 3000, offer: 2500 },
          { t: 'Printer installation', bn: 'প্রিন্টার ইন্সটল করা', reg: 800, offer: 500 },
          { t: 'Printer sharing & networking', bn: 'প্রিন্টার শেয়ারিং এবং নেটওয়ার্কিং', reg: 800, offer: 600 },
          { t: 'Minimum diagnosis charge (inside Dhaka)', bn: 'সমস্যা নির্ণয় — সর্বনিম্ন চার্জ (ঢাকার মধ্যে)', reg: 1000, offer: 800 },
          { t: 'Minimum diagnosis charge (outside Dhaka)', bn: 'সমস্যা নির্ণয় — সর্বনিম্ন চার্জ (ঢাকার বাহিরে)', reg: 2500, offer: 1800 }
        ] }
    };
  }

  let S = null;
  function load() {
    if (S) return S;
    try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
    if (!S || S.v !== 2) { S = seed(); save(); }
    if (!S.accounts || !S.admins) { const f = seed(); S.accounts = S.accounts || f.accounts; S.admins = S.admins || f.admins; S.compare = S.compare || []; save(); }
    if (!S.rolesV2) { S.admins = (S.admins || []).map(x => ({ ...x, role: x.role === 'Owner' ? 'Super admin' : (x.role === 'Manager' || x.role === 'Staff' || x.role === 'Sales' || x.role === 'Service engineer') ? 'Admin' : x.role }));
      [['Rafiq Rider', 'rider@artradeinternational.com', 'rider123', 'Delivery rider'], ['Nusrat Marketing', 'marketing@artradeinternational.com', 'market123', 'Marketing manager']].forEach(([name, email, pass, role]) => { if (!S.admins.find(x => x.email === email)) S.admins.push({ name, email, pass, role, status: 'Active', at: Date.now() }); });
      S.subscribers = S.subscribers && S.subscribers.length ? S.subscribers : ['rahim.it@gmail.com', 'procure@brac.net', 'office@dhakabank.com', 'admin@nsu.edu.bd', 'sabbir.print@yahoo.com'];
      S.campaigns = S.campaigns || [{ id: 'CMP-101', subject: 'Friday deals: up to 19% off HP toner', audience: 'All subscribers', body: 'This week only.', sent: 5, at: Date.now() - 6 * 864e5 }];
      S.rolesV2 = true; save(); }
    return S;
  }
  let _pc = null;
  function save() { _pc = null; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function update(fn) { load(); fn(S); save(); window.dispatchEvent(new Event('ar:change')); }
  window.addEventListener('storage', e => { if (e.key === KEY) { S = null; _pc = null; window.dispatchEvent(new Event('ar:change')); } });

  function products() {
    const s = load();
    if (_pc && _pc.s === s) return _pc.list;
    const list = P.concat(s.extra).map(p => Object.assign({}, p, s.edits[p.id] || {})).filter(p => !p.deleted);
    _pc = { s, list, byId: new Map(list.map(p => [String(p.id), p])) };
    return list;
  }
  function find(id) { products(); return _pc.byId.get(String(id)); }
  function specs(p) {
    const base = [['Brand', p.brand], ['Part no.', p.part], ['Technology', p.tech], ['Printing colour', p.color], ['Page yield / capacity', p.yield], ['Compatible printers', p.compat]];
    return base.concat(p.extra || []).filter(r => r[1] && r[1] !== '—').concat([['Warranty', 'Yes — 100% original product']]);
  }
  function cartLines() {
    const s = load();
    return Object.entries(s.cart).map(([id, qty]) => { const p = find(id); return p ? Object.assign({}, p, { qty }) : null; }).filter(Boolean);
  }
  function totals(area, coupon, o) {
    o = o || {}; const s = load(); const set = s.settings; const raw = cartLines();
    const lines = raw.map(l => { const avail = Math.max(0, Math.min(l.qty, l.stock || 0)); const held = !!l.needsApproval || l.price >= 100000; const short = l.qty - avail; const chargeQty = o.partial === 'drop' ? avail : l.qty; return Object.assign({}, l, { avail, short, held, chargeQty }); });
    const subtotal = lines.reduce((a, b) => a + b.price * b.chargeQty, 0);
    const saved = lines.reduce((a, b) => a + Math.max(0, (b.old || b.price) - b.price) * b.chargeQty, 0);
    const cu = (coupon || '').trim().toUpperCase(); const welcome = cu === 'WELCOME10';
    const okCoupon = !!cu && (cu === set.coupon || welcome);
    const discount = okCoupon ? Math.round(subtotal * (welcome ? 10 : set.couponPct) / 100) : 0;
    const memberPct = s.user ? (set.memberPct != null ? set.memberPct : 3) : 0;
    const member = Math.round((subtotal - discount) * memberPct / 100);
    const freeOver = set.freeOver != null ? set.freeOver : 5000;
    const zone = area || 'inside';
    const base = zone === 'outside' ? set.outsideFee : zone === 'suburb' ? (set.suburbFee != null ? set.suburbFee : 100) : set.insideFee;
    const freeElig = zone !== 'outside' && subtotal >= freeOver;
    const express = !!o.express && zone === 'inside' ? (set.expressFee != null ? set.expressFee : 150) : 0;
    const delivery = subtotal ? (freeElig ? 0 : base) + express : 0;
    const total = Math.max(0, subtotal - discount - member + delivery);
    const vatPct = set.vatPct != null ? set.vatPct : 5;
    const vat = Math.round(total * vatPct / (100 + vatPct));
    return { lines, subtotal, saved, discount, member, memberPct, delivery, express, base, freeOver, freeElig, freeLeft: zone === 'outside' ? 0 : Math.max(0, freeOver - subtotal), zone, total, vat, vatPct, okCoupon, heldN: lines.filter(l => l.held).length, shortN: lines.filter(l => l.short > 0).length, count: lines.reduce((a, b) => a + b.qty, 0) };
  }

  const SF_DEFAULTS = {"sections":{"perks":true,"categories":true,"popular":true,"offer":true,"fresh":true,"services":true,"brands":true,"alert":true},"slideSecs":5.5,"slides":[{"on":true,"type":"image","img":"https://artradeinternational.com/wp-content/uploads/artrade-topBanner-Toner-Image.jpg","href":"#/shop/toner","alt":"AR Trade original toner","ratio":2.68},{"on":true,"type":"image","img":"./assets/cashback-banner-crop.png","href":"#/offers","alt":"ক্যাশব্যাক অফার","ratio":1.83},{"on":true,"type":"design","tag":"Since 2011 · 159 Santinagar, Dhaka","title":"{heroTitle}","sub":"{heroSub}","c1":"Shop toner & ink","h1":"#/shop/toner","c2":"Get a corporate quote","h2":"#/contact","badgeT":"Since","badgeV":"2011","pic":"https://artradeinternational.com/wp-content/uploads/2019/02/hp-416a-full-set-toner.jpg"},{"on":true,"type":"design","tag":"New arrivals","title":"Pantum Wi-Fi laser printers","sub":"Duplex, wireless and fast office printing, from ৳ 20,000 with official warranty.","c1":"Shop printers","h1":"#/shop/printer","c2":"Talk to sales","h2":"#/contact","badgeT":"From","badgeV":"৳ 20,000","pic":"https://artradeinternational.com/wp-content/uploads/2024/10/m7105dw-01-500x500-1.png"},{"on":true,"type":"design","tag":"Copier toner","title":"Up to 18% off Toshiba & Sharp copier toner","sub":"Original cartridges for office photocopiers, with same-day delivery inside Dhaka.","c1":"Shop copier toner","h1":"#/shop/copier-toner","c2":"Book servicing","h2":"#/services","badgeT":"Save up to","badgeV":"18%","pic":"https://artradeinternational.com/wp-content/uploads/2018/12/Toshiba-5018P-Photocopier-toner.jpg"}],"words":["Search HP 79A toner (CF279A)…","Search Canon imageRUNNER photocopier…","Search Pantum Wi-Fi laser printer…","Search Epson 057 ink bottle…","Search Toshiba T-5018P copier toner…"],"perks":[{"ic":"⇢","t":"Free delivery in Dhaka","d":"Same-day dispatch","dot":"oklch(0.72 0.13 220)"},{"ic":"✓","t":"100% authentic","d":"Original, warranty backed","dot":"oklch(0.6 0.2 350)"},{"ic":"৳","t":"Cash on delivery","d":"Plus bKash, Nagad & Upay","dot":"oklch(0.82 0.13 85)"},{"ic":"☏","t":"Expert support","d":"Call or WhatsApp","dot":"#16181d"}],"brands":[{"n":"Canon","src":"https://artradeinternational.com/wp-content/uploads/2022/04/canon.png"},{"n":"Epson","src":"https://artradeinternational.com/wp-content/uploads/2022/04/epson.png"},{"n":"Brother","src":"https://artradeinternational.com/wp-content/uploads/2022/04/brother.png"},{"n":"HP","src":"https://artradeinternational.com/wp-content/uploads/2022/04/hp.png"},{"n":"Lexmark","src":"https://artradeinternational.com/wp-content/uploads/2022/04/laxmark.png"},{"n":"Samsung","src":"https://artradeinternational.com/wp-content/uploads/2022/04/samsung.png"},{"n":"Xerox","src":"https://artradeinternational.com/wp-content/uploads/2022/04/xerox.png"}],"labels":{"catKick":"01 / Categories","catTitle":"Shop by category","popKick":"02 / Popular","popTitle":"Best-selling supplies","newKick":"03 / Just in","newTitle":"New collection","viewNew":"View all new →","needToner":"Need toner today?"},"faqs":[{"q":"How do I place an order?","a":"Add products to your cart and check out. You can pay by cash on delivery, bKash, Nagad, Upay or bank transfer. You can also order by calling or WhatsApp-ing {phone}."},{"q":"How long does delivery take?","a":"Orders placed before 2 PM are delivered the same day inside Dhaka. Outside Dhaka, courier delivery takes 1–3 working days."},{"q":"How much is delivery?","a":"Inside Dhaka: {fmt insideFee}. Outside Dhaka: {fmt outsideFee} by courier."},{"q":"Are your products original?","a":"Yes. We sell only genuine products from HP, Canon, Epson, Brother, Toshiba, Sharp and other authorised brands, with warranty."},{"q":"Can I return or replace a product?","a":"Unused products in original packaging can be returned within 7 days. Faulty items are replaced under warranty. See our Return & Refund policy."},{"q":"Do you offer corporate or bulk pricing?","a":"Yes. Contact us with your requirement and we will send a quotation for offices, banks, NGOs and government institutions."},{"q":"How can I track my order?","a":"Use the Track order page with your order ID and mobile number, or check My account → Orders."}],"policies":[{"k":"privacy","t":"Privacy policy","secs":[{"h":"Information we collect","p":"Name, mobile number, email and delivery address you provide when you register or place an order."},{"h":"How we use it","p":"To process orders, arrange delivery, provide support and send offers you have subscribed to. We never sell your data."},{"h":"Payments","p":"Mobile banking and card payments are handled by the payment provider. We do not store your PIN or card details."},{"h":"Your choices","p":"You can update your profile or ask us to delete your account at any time by contacting {email}."}]},{"k":"terms","t":"Terms & conditions","secs":[{"h":"Prices","p":"Technology product prices can change at any time. The price at the time your order is confirmed applies."},{"h":"Orders","p":"We may cancel an order if a product is out of stock or a price was shown in error. Any payment will be fully refunded."},{"h":"Warranty","p":"Warranty is provided according to each manufacturer’s terms. Keep your invoice for warranty claims."},{"h":"Contact","p":"AR Trade International, {address}. Phone {phone}."}]},{"k":"returns","t":"Return & refund policy","secs":[{"h":"7-day returns","p":"Unused products in original sealed packaging can be returned within 7 days of delivery."},{"h":"Faulty products","p":"If a product arrives damaged or faulty, contact us within 48 hours and we will replace it free of charge."},{"h":"Refunds","p":"Approved refunds are sent within 5–7 working days to the original payment method or by bKash/Nagad."},{"h":"Not returnable","p":"Opened toner, ink and consumables cannot be returned unless faulty."}]},{"k":"shipping","t":"Shipping & delivery","secs":[{"h":"Inside Dhaka","p":"Same-day delivery for orders before 2 PM, with cash on delivery."},{"h":"Outside Dhaka","p":"Courier delivery to all 64 districts within 1–3 working days. Delivery charge {fmt outsideFee}."},{"h":"Large items","p":"Photocopiers and large printers are delivered and installed by our engineers."},{"h":"Pickup","p":"You can also collect orders from our showroom at {address}."}]}],"stats":[{"v":"2011","t":"Founded in Dhaka"},{"v":"40+","t":"Team members"},{"v":"7","t":"Authorised brands"},{"v":"1","t":"Showroom — no branches"}],"whys":[{"t":"The right team","d":"Engineers for printers, computers, CCTV and photocopiers — unbiased advice at an honest price."},{"t":"We listen","d":"We understand your needs first, then recommend what actually fits."},{"t":"Full satisfaction","d":"We keep working until you are happy with the result."},{"t":"Experience","d":"Hardware since 2011, IT services since 2019."},{"t":"Affordable","d":"Fair margins so every office can get genuine supplies."},{"t":"Friendly","d":"Plain language, no techno-babble."}],"clients":["https://artradeinternational.com/wp-content/uploads/2020/07/logo6.png","https://artradeinternational.com/wp-content/uploads/2020/07/client2.png","https://artradeinternational.com/wp-content/uploads/2020/07/logo15.png","https://artradeinternational.com/wp-content/uploads/2020/07/logo14.png","https://artradeinternational.com/wp-content/uploads/2020/07/logo13.png","https://artradeinternational.com/wp-content/uploads/2020/07/logo12.png","https://artradeinternational.com/wp-content/uploads/2020/07/logo11.png","https://artradeinternational.com/wp-content/uploads/2020/07/logo10.png","https://artradeinternational.com/wp-content/uploads/2021/09/A-tex-International.jpg","https://artradeinternational.com/wp-content/uploads/2021/09/CSRM.jpg","https://artradeinternational.com/wp-content/uploads/2021/09/AB-Group.jpg","https://artradeinternational.com/wp-content/uploads/2021/09/APS-Group-BD.jpg","https://artradeinternational.com/wp-content/uploads/2021/09/BIFPCL.jpg","https://artradeinternational.com/wp-content/uploads/2021/09/Trimco-Group.jpg","https://artradeinternational.com/wp-content/uploads/2021/09/mmk.jpg","https://artradeinternational.com/wp-content/uploads/2020/07/client1.png"],"social":{"facebook":"https://fb.com/ARTradeInternational2011","instagram":"https://instagram.com/artradeinternational","linkedin":"https://linkedin.com/company/artrade-international/","youtube":"https://www.youtube.com","x":"https://x.com"},"popup":{"on":true,"delay":30,"exit":true}};
  function sf() { const s = load().settings.sf || {}; const o = {}; Object.keys(SF_DEFAULTS).forEach(k => { const dv = SF_DEFAULTS[k], v = s[k]; o[k] = v == null ? dv : (dv && typeof dv === 'object' && !Array.isArray(dv)) ? Object.assign({}, dv, v) : v; }); return o; }
  function tk(str) { const st = load().settings; return String(str == null ? '' : str).replace(/\{fmt (\w+)\}/g, (_, k) => st[k] ? fmt(st[k]) : 'free').replace(/\{(\w+)\}/g, (m, k) => st[k] != null ? st[k] : m); }
  function invoiceHtml(o) { const AR = window.AR, fmt = AR.fmt;

          const S = AR.state().settings, esc = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
          const inv = 'INV-' + o.id.replace('AR-', ''), dd = o.history.find(x => x.s === 'Delivered');
          const qrData = 'AR Trade International | Invoice ' + inv + ' | Order ' + o.id + ' | Total BDT ' + o.total + ' | Delivered ' + (dd ? AR.date(dd.at) : '') + ' | Verify: artradeinternational.com';
          const qr = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=4&data=' + encodeURIComponent(qrData);
          const rows = o.items.map((i, k) => '<tr><td><span class=n>' + (k + 1) + '</span></td><td class=nm>' + esc(i.name) + '</td><td class=r>' + i.qty + '</td><td class=r>' + fmt(i.price) + '</td><td class=r>' + fmt(i.price * i.qty) + '</td></tr>').join('');
          const logo = new URL('./assets/ar-icon-round.png', location.href).href;
          const html = '<!doctype html><html><head><meta charset=utf-8><title>' + inv + '</title><style>@page{size:A4;margin:0}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}html,body{margin:0;background:#fff}body{font-family:Manrope,Segoe UI,Arial,sans-serif;color:#0b1631;font-size:12.5px;line-height:1.5}.pg{min-height:1120px;display:flex;flex-direction:column}.hd{position:relative;overflow:hidden;background:linear-gradient(120deg,#0b1631 0%,#13265a 60%,#1c4f9c 100%);color:#fff;padding:34px 44px 30px;display:flex;justify-content:space-between;align-items:flex-start;gap:24px}.hd:after{content:"";position:absolute;right:-80px;top:-120px;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,rgba(120,190,255,.35),transparent 70%)}.brand{display:flex;gap:14px;align-items:center;position:relative;z-index:1}.brand img{width:62px;height:62px;border-radius:50%;background:#fff;padding:3px;box-shadow:0 0 0 3px rgba(255,255,255,.18)}.brand h1{margin:0;font-size:22px;letter-spacing:-.01em}.brand .s{color:#b9c6e4;font-size:11.5px;line-height:1.55}.meta{text-align:right;position:relative;z-index:1}.tag{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.2em;color:#9fd0ff;border:1px solid rgba(159,208,255,.4);border-radius:999px;padding:3px 10px}.meta h2{margin:8px 0 4px;font-size:30px;letter-spacing:-.02em;line-height:1}.meta .s{color:#b9c6e4;font-size:11.5px}.strip{display:grid;grid-template-columns:repeat(4,1fr);margin:0 44px;transform:translateY(-18px);background:#fff;border-radius:14px;box-shadow:0 12px 30px -14px rgba(11,22,49,.35);border:1px solid #e6ebf4;overflow:hidden}.strip div{padding:12px 16px;border-right:1px solid #eef1f7}.strip div:last-child{border:0}.k{font-size:9.5px;letter-spacing:.14em;font-weight:800;color:#7a86a0;text-transform:uppercase}.v{font-weight:800;font-size:13.5px;margin-top:2px}.ok{color:#1f8a4c}.main{padding:6px 44px 0;flex:1}.cards{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px}.card{border:1px solid #e6ebf4;border-radius:12px;padding:14px 16px;position:relative}.card:before{content:"";position:absolute;left:16px;top:0;width:34px;height:3px;border-radius:0 0 3px 3px;background:linear-gradient(90deg,#3b8fe0,#1c4f9c)}.card b{font-size:14px}.mu{color:#5d6680}table.it{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e6ebf4;border-radius:12px;overflow:hidden}.it th{background:#f3f6fc;color:#4a5878;text-align:left;padding:10px 14px;font-size:10px;letter-spacing:.12em;font-weight:800;border-bottom:1px solid #e6ebf4}.it td{padding:12px 14px;border-bottom:1px solid #eef1f7}.it tr:last-child td{border-bottom:0}.it tbody tr:nth-child(even) td{background:#fafbfe}.n{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:6px;background:#eaf2fd;color:#1c4f9c;font-weight:800;font-size:11px}.nm{font-weight:700}.r{text-align:right}.sum{display:grid;grid-template-columns:1fr 300px;gap:24px;margin-top:20px;align-items:start}.qr{display:flex;gap:14px;align-items:center;border:1px dashed #c9d4ea;border-radius:12px;padding:12px}.qr img{width:104px;height:104px;border-radius:8px}.qr b{font-size:13px}.tt{border:1px solid #e6ebf4;border-radius:12px;overflow:hidden}.tt .row{display:flex;justify-content:space-between;padding:9px 16px;border-bottom:1px solid #eef1f7}.tt .row span:first-child{color:#5d6680}.tt .grand{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;background:linear-gradient(120deg,#0b1631,#1c4f9c);color:#fff}.tt .grand b{font-size:20px;letter-spacing:-.01em}.paid{display:inline-flex;align-items:center;gap:6px;margin-top:10px;background:#e8f7ee;color:#1f8a4c;font-weight:800;font-size:11px;letter-spacing:.1em;padding:6px 12px;border-radius:999px}.sig{display:flex;justify-content:space-between;margin-top:46px;gap:40px}.sig div{flex:1;border-top:1px solid #c9d4ea;padding-top:6px;font-size:11px;color:#7a86a0}.ft{margin-top:30px;background:#0b1631;color:#b9c6e4;padding:14px 44px;display:flex;justify-content:space-between;font-size:11px}.ft b{color:#fff}</style></head><body><div class=pg>'
            + '<div class=hd><div class=brand><img src="' + logo + '"><div><h1>AR Trade International</h1><div class=s>' + esc(S.address) + '<br>' + esc(S.phone) + ' · ' + esc(S.email) + '</div></div></div><div class=meta><span class=tag>TAX INVOICE</span><h2>' + inv + '</h2><div class=s>Order ' + o.id + '</div></div></div>'
            + '<div class=strip><div><div class=k>Invoice date</div><div class=v>' + AR.date(dd ? dd.at : o.date) + '</div></div><div><div class=k>Order placed</div><div class=v>' + AR.date(o.date) + '</div></div><div><div class=k>Payment</div><div class=v>' + esc(o.payment) + '</div></div><div><div class=k>Status</div><div class="v ok">● Paid · Delivered</div></div></div>'
            + '<div class=main><div class=cards><div class=card><div class=k>Billed to</div><b>' + esc(o.customer.name) + '</b><div class=mu>' + esc(o.customer.phone) + (o.customer.email ? '<br>' + esc(o.customer.email) : '') + '</div></div><div class=card><div class=k>Delivered to</div><b>' + (o.area === 'outside' ? 'Outside Dhaka · courier' : 'Inside Dhaka') + '</b><div class=mu>' + esc(o.address) + '</div></div></div>'
            + '<table class=it><thead><tr><th style="width:44px">#</th><th>Item</th><th class=r>Qty</th><th class=r>Unit price</th><th class=r>Amount</th></tr></thead><tbody>' + rows + '</tbody></table>'
            + '<div class=sum><div><div class=qr><img src="' + qr + '"><div><b>Scan to verify</b><div class=mu>Invoice ' + inv + '<br>Order ' + o.id + '<br>artradeinternational.com</div></div></div><span class=paid>✓ PAYMENT RECEIVED</span></div><div class=tt><div class=row><span>Subtotal</span><span>' + fmt(o.subtotal) + '</span></div><div class=row><span>Discount</span><span>− ' + fmt(o.discount) + '</span></div><div class=row><span>Delivery</span><span>' + (o.delivery ? fmt(o.delivery) : 'Free') + '</span></div><div class=grand><span>Total</span><b>' + fmt(o.total) + '</b></div></div></div>'
            + '<div class=sig><div>Customer signature</div><div style="text-align:right">For AR Trade International</div></div></div>'
            + '<div class=ft><span><b>Thank you for shopping with us.</b> Warranty as per manufacturer terms.</span><span>Computer-generated invoice · no signature required</span></div>'
            + '</div></body></html>';
          
    return { html, inv }; }
  const SEO_DEFAULTS = {"site":"AR Trade International","sep":" | ","titleTpl":"{page}{sep}{site}","desc":"Original toner, ink, printers and photocopiers in Bangladesh. Cash on delivery across Dhaka.","kw":"toner Bangladesh, printer price in BD, HP toner Dhaka, Canon photocopier, Pantum printer","ogImage":"https://artradeinternational.com/wp-content/uploads/2019/09/artrade-logo.png","base":"https://artradeinternational.com","index":true,"twitter":"","locale":"en_BD","prodTitle":"{name} ({part}) — {brand} Price in BD","prodDesc":"Buy original {brand} {name} at {price} in Bangladesh. {spec}. Fast delivery in Dhaka, cash on delivery.","prodKw":"{brand}, {part}, {cat}, {name} price in Bangladesh","schemaProduct":true,"schemaOrg":true,"schemaCrumbs":true,"gsc":"","bing":"","ga":"","pixel":"","pages":{"home":{"l":"Home","t":"AR Trade International — Original Toner, Printers & Copiers in Bangladesh","d":"Original HP, Canon, Toshiba & Pantum toner, ink, printers and photocopiers in Dhaka. Genuine products, cash on delivery and expert servicing since 2011.","kw":"","noindex":false},"shop":{"l":"Shop / category","t":"{cat} — Buy Online in Bangladesh","d":"Shop {cat} at the best price in Bangladesh. Original products with warranty and fast delivery across Dhaka.","kw":"","noindex":false},"offers":{"l":"Offers","t":"Offers & Discounts on Toner and Printers","d":"Latest deals, coupons and cash-back offers on original toner, ink and printers.","kw":"","noindex":false},"services":{"l":"Servicing","t":"Printer & Photocopier Servicing in Dhaka","d":"Book printer, photocopier and multifunction servicing by certified engineers.","kw":"","noindex":false},"about":{"l":"About","t":"About AR Trade International","d":"Trusted supplier of original printer consumables in Bangladesh since 2011.","kw":"","noindex":false},"contact":{"l":"Contact","t":"Contact Us","d":"Call, WhatsApp or visit AR Trade International at Santinagar, Dhaka.","kw":"","noindex":false},"faq":{"l":"FAQ","t":"Frequently Asked Questions","d":"Answers about orders, delivery, payment, warranty and returns.","kw":"","noindex":false},"policy":{"l":"Policy pages","t":"{page}","d":"Read our policies.","kw":"","noindex":false},"compare":{"l":"Compare","t":"Compare Products","d":"Compare toner, printers and copiers side by side.","kw":"","noindex":false},"track":{"l":"Track order","t":"Track Your Order","d":"Track your AR Trade order with your order ID.","kw":"","noindex":false},"cart":{"l":"Cart & checkout","t":"Your Cart","d":"","kw":"","noindex":true},"wishlist":{"l":"Wishlist","t":"Your Wishlist","d":"","kw":"","noindex":true}}};
  function seo() { const s = load().settings.seo || {}; const o = Object.assign({}, SEO_DEFAULTS, s); o.pages = {}; Object.keys(SEO_DEFAULTS.pages).forEach(k => { o.pages[k] = Object.assign({}, SEO_DEFAULTS.pages[k], (s.pages || {})[k] || {}); }); return o; }
  function slugify(x) { return String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80); }
  function seoTok(str, t) { return String(str || '').replace(/\{(\w+)\}/g, (m, k) => t[k] != null ? t[k] : '').replace(/\s*\(\s*\)/g, '').replace(/\s+([.,])/g, '$1').replace(/\s{2,}/g, ' ').trim(); }
  function seoPage(key, extra) { const S = seo(), pg = S.pages[key] || S.pages.home, t = Object.assign({ site: S.site, sep: S.sep }, extra || {});
    const page = seoTok(pg.t, t); const title = key === 'home' ? page : seoTok(S.titleTpl, Object.assign({}, t, { page }));
    return { title, desc: seoTok(pg.d || S.desc, t), kw: pg.kw || S.kw, noindex: !S.index || !!pg.noindex, img: S.ogImage, url: S.base + '/' + (key === 'home' ? '' : key) }; }
  function seoFor(p) { const S = seo(), c = CATS.find(x => x.id === p.cat), price = p.price ? fmt(p.price) : 'best price';
    const t = { name: p.name, brand: p.brand, part: p.part && !String(p.name || '').toLowerCase().includes(String(p.part).toLowerCase()) ? p.part : '', cat: c ? c.t : '', price, spec: p.spec || '', site: S.site, sep: S.sep };
    const autoT = seoTok(S.prodTitle, t), autoD = seoTok(S.prodDesc, t), slug = p.slug || slugify(p.name);
    const title = p.seoTitle || autoT, desc = p.seoDesc || autoD;
    const checks = [[title.length >= 30 && title.length <= 60, 'Title 30–60 characters (' + title.length + ')'], [desc.length >= 120 && desc.length <= 160, 'Description 120–160 characters (' + desc.length + ')'],
      [!!p.focusKw && (title + ' ' + desc).toLowerCase().includes(String(p.focusKw).toLowerCase()), 'Focus keyword in title or description'], [!!p.img || !!p.ogImg, 'Has a share image'], [!!p.seoTitle || !!p.seoDesc, 'Custom title or description written'], [!p.noindex, 'Indexable by search engines']];
    const score = Math.round(checks.filter(x => x[0]).length / checks.length * 100);
    return { title, desc, autoT, autoD, kw: p.seoKw || seoTok(S.prodKw, t), slug, url: S.base + '/product/' + slug, img: p.ogImg || p.img || S.ogImage, noindex: !S.index || !!p.noindex, canonical: p.canonical || '', score, checks: checks.map(([ok, l]) => ({ ok, l })), custom: !!(p.seoTitle || p.seoDesc) }; }
  const EXP_CATS = ['Inventory purchase', 'Rent', 'Salaries', 'Marketing & ads', 'Delivery & courier', 'Payment gateway fees', 'Utilities', 'Software & hosting', 'Packaging', 'Servicing parts', 'Other'];
  function finance() { const s = load(); if (!s.expenses) { const now = Date.now(), M = 30 * DAY; const seedE = [];
      [[0, 'Rent', 45000, 'Bank', 'Santinagar shop rent'], [0, 'Salaries', 120000, 'Bank', 'Staff salaries (6)'], [0.2, 'Marketing & ads', 18000, 'Card', 'Facebook & Google ads'], [0.3, 'Delivery & courier', 9500, 'bKash', 'Pathao / Steadfast'], [0.4, 'Utilities', 7200, 'Cash', 'Electricity & internet'], [0.5, 'Inventory purchase', 260000, 'Bank', 'HP & Canon toner restock'], [0.6, 'Software & hosting', 4500, 'Card', 'Hosting, domain, email'], [0.7, 'Packaging', 3800, 'Cash', 'Boxes & bubble wrap'],
       [1, 'Rent', 45000, 'Bank', 'Shop rent'], [1, 'Salaries', 118000, 'Bank', 'Staff salaries'], [1.2, 'Marketing & ads', 22000, 'Card', 'Eid campaign ads'], [1.3, 'Delivery & courier', 11200, 'bKash', 'Courier bills'], [1.4, 'Utilities', 6900, 'Cash', 'Electricity & internet'], [1.5, 'Inventory purchase', 310000, 'Bank', 'Pantum & Toshiba stock'], [1.8, 'Servicing parts', 14500, 'Cash', 'Drums & fusers'],
       [2, 'Rent', 45000, 'Bank', 'Shop rent'], [2, 'Salaries', 115000, 'Bank', 'Staff salaries'], [2.3, 'Marketing & ads', 15000, 'Card', 'Ads'], [2.4, 'Utilities', 7400, 'Cash', 'Electricity & internet'], [2.5, 'Inventory purchase', 240000, 'Bank', 'Ink & toner restock']].forEach(([m, cat, amt, method, note], i) => seedE.push({ id: 'EX-' + (1001 + i), at: now - m * M - (i % 5) * DAY, cat, amt, method, note, recurring: ['Rent', 'Salaries', 'Software & hosting'].includes(cat) }));
      update(x => { x.expenses = seedE; x.budgets = x.budgets || { 'Inventory purchase': 300000, 'Rent': 45000, 'Salaries': 125000, 'Marketing & ads': 20000, 'Delivery & courier': 12000, 'Payment gateway fees': 6000, 'Utilities': 8000, 'Software & hosting': 5000, 'Packaging': 4000, 'Servicing parts': 10000, 'Other': 5000 }; x.finCfg = x.finCfg || { cogsPct: 72, gatewayPct: 1.85, vatPct: 5, revenueTarget: 1500000 }; }); }
    const S2 = load(); return { expenses: S2.expenses || [], budgets: S2.budgets || {}, cfg: S2.finCfg || { cogsPct: 72, gatewayPct: 1.85, vatPct: 5, revenueTarget: 1500000 } }; }
  const JOBS_SEED = [
    { id: 'J-101', title: 'Sales Executive (Corporate)', dept: 'Sales', type: 'Full-time', loc: 'Santinagar, Dhaka', exp: '1–3 years', salary: '৳25,000 – 35,000', vacancies: 2, deadline: Date.now() + 25 * DAY, open: true,
      about: 'Grow our corporate accounts for toner, printers and photocopiers across Dhaka.', resp: ['Visit offices and close B2B supply orders', 'Prepare quotations and follow up with clients', 'Hit monthly sales targets', 'Keep CRM records up to date'], req: ['Bachelor degree in any discipline', '1+ year B2B sales experience', 'Good communication in Bangla and English', 'Own motorcycle is a plus'], perks: ['Monthly sales commission', 'Mobile & transport allowance', '2 festival bonuses'] },
    { id: 'J-102', title: 'Printer & Photocopier Service Engineer', dept: 'Service', type: 'Full-time', loc: 'Dhaka (field)', exp: '2–5 years', salary: '৳30,000 – 45,000', vacancies: 3, deadline: Date.now() + 18 * DAY, open: true,
      about: 'Install, repair and maintain HP, Canon, Toshiba and Pantum machines at client sites.', resp: ['Diagnose and repair laser printers and copiers', 'Do preventive maintenance visits', 'Replace drums, fusers and parts', 'Log every service job'], req: ['Diploma in Electrical / Electronics', '2+ years printer or copier servicing', 'Knows HP, Canon or Toshiba models'], perks: ['Field allowance', 'Training from brand partners', 'Overtime pay'] },
    { id: 'J-103', title: 'E-commerce & Digital Marketing Executive', dept: 'Marketing', type: 'Full-time', loc: 'Santinagar, Dhaka', exp: '1–2 years', salary: '৳22,000 – 30,000', vacancies: 1, deadline: Date.now() + 30 * DAY, open: true,
      about: 'Run our online store, Facebook ads and email campaigns.', resp: ['Upload products and keep prices updated', 'Run Facebook and Google ads', 'Write email and social posts', 'Report weekly on sales and traffic'], req: ['Hands-on Facebook Ads Manager', 'Basic Canva / Photoshop', 'Knows SEO basics'], perks: ['Performance bonus', 'Learning budget'] },
    { id: 'J-104', title: 'Delivery Rider', dept: 'Logistics', type: 'Contract', loc: 'Dhaka city', exp: 'Freshers welcome', salary: '৳15,000 + per delivery', vacancies: 4, deadline: Date.now() + 12 * DAY, open: true,
      about: 'Deliver orders safely and collect cash on delivery.', resp: ['Pick up and deliver orders on time', 'Collect COD and hand over daily', 'Use the rider app for OTP proof'], req: ['Valid driving licence', 'Own motorcycle', 'Smartphone'], perks: ['Fuel allowance', 'Per-delivery bonus'] },
    { id: 'J-105', title: 'Accounts Intern', dept: 'Finance', type: 'Internship', loc: 'Santinagar, Dhaka', exp: 'Final year students', salary: '৳8,000 stipend', vacancies: 1, deadline: Date.now() - 2 * DAY, open: false,
      about: 'Support daily bookkeeping, invoices and supplier payments.', resp: ['Record expenses and invoices', 'Reconcile COD and bKash payments'], req: ['BBA / BCom student', 'Excel basics'], perks: ['Certificate', 'Job offer for top performers'] }
  ];
  const APP_STAGES = ['New', 'Shortlisted', 'Interview', 'Offered', 'Hired', 'Rejected'];
  function careers() { const s = load(); if (!s.jobs) update(x => { x.jobs = JOBS_SEED; x.applications = [
      { id: 'APP-2001', job: 'J-102', name: 'Rakib Hasan', phone: '01812345678', email: 'rakib@example.com', exp: '3 years', salary: '40000', note: 'Worked 3 years at a Canon service centre.', cv: 'Rakib_Hasan_CV.pdf', cvData: '', stage: 'Interview', at: Date.now() - 4 * DAY, rating: 4 },
      { id: 'APP-2002', job: 'J-101', name: 'Nusrat Jahan', phone: '01911223344', email: 'nusrat@example.com', exp: '2 years', salary: '30000', note: '', cv: 'Nusrat_CV.pdf', cvData: '', stage: 'Shortlisted', at: Date.now() - 2 * DAY, rating: 3 },
      { id: 'APP-2003', job: 'J-104', name: 'Sohel Rana', phone: '01755667788', email: '', exp: 'Fresher', salary: '15000', note: 'Have my own bike.', cv: 'Sohel_Rana.pdf', cvData: '', stage: 'New', at: Date.now() - 6 * 36e5, rating: 0 }]; });
    const S2 = load(); return { jobs: S2.jobs || [], apps: S2.applications || [] }; }
  const AR = {
    U, fmt, CATS, APP_STAGES, careers,
    saveJob(j) { update(s => { s.jobs = s.jobs || []; const i = s.jobs.findIndex(x => x.id === j.id); if (i >= 0) s.jobs[i] = Object.assign({}, s.jobs[i], j); else s.jobs.unshift(Object.assign({ id: 'J-' + (101 + s.jobs.length + Math.floor(Math.random() * 50)) }, j)); }); },
    delJob(id) { update(s => { s.jobs = (s.jobs || []).filter(x => x.id !== id); }); },
    applyJob(a) { let id; update(s => { s.applications = s.applications || []; id = 'APP-' + (2001 + s.applications.length + Math.floor(Math.random() * 90)); s.applications.unshift(Object.assign({ id, stage: 'New', at: Date.now(), rating: 0 }, a)); }); return id; },
    setApp(id, p) { update(s => { const a = (s.applications || []).find(x => x.id === id); if (a) Object.assign(a, p); }); },
    delApp(id) { update(s => { s.applications = (s.applications || []).filter(x => x.id !== id); }); },
    EXP_CATS, finance, addExpense(e) { update(s => { s.expenses = s.expenses || []; s.expenses.push(Object.assign({ id: 'EX-' + (1001 + s.expenses.length + Math.floor(Math.random() * 90)), at: Date.now() }, e)); }); }, delExpense(id) { update(s => { s.expenses = (s.expenses || []).filter(x => x.id !== id); }); }, setBudgets(b) { update(s => { s.budgets = Object.assign({}, s.budgets || {}, b); }); }, setFinCfg(c) { update(s => { s.finCfg = Object.assign({}, s.finCfg || {}, c); }); }, SEO_DEFAULTS, seo, seoPage, seoFor, slugify, saveSeo(p) { update(s => { s.settings.seo = Object.assign({}, s.settings.seo || {}, p); }); }, resetSeo() { update(s => { delete s.settings.seo; }); }, invoiceHtml, mailInvoice(id, m) { update(s => { const o = s.orders.find(x => x.id === id); if (!o) return; o.invMails = (o.invMails || []).concat([Object.assign({ at: Date.now() }, m)]); s.emailLog = (s.emailLog || []).concat([Object.assign({ at: Date.now(), type: "invoice", order: id }, m)]); }); }, SF_DEFAULTS, sf, tk, saveSf(p) { update(s => { s.settings.sf = Object.assign({}, s.settings.sf || {}, p); }); }, resetSf(k) { update(s => { if (s.settings.sf) delete s.settings.sf[k]; }); }, STATUSES, SVC_STATUSES, DEMO_USER,
    state: load, update, products, find, specs, cartLines, totals,
    cat: id => CATS.find(c => c.id === id),
    addToCart(id, n) { update(s => { s.cart[id] = (s.cart[id] || 0) + (n || 1); }); },
    setQty(id, n) { update(s => { if (n <= 0) delete s.cart[id]; else s.cart[id] = n; }); },
    toggleWish(id) { update(s => { const i = s.wish.indexOf(id); if (i >= 0) s.wish.splice(i, 1); else s.wish.push(id); }); },
    login(u) { update(s => { s.user = Object.assign({ since: String(new Date().getFullYear()) }, u); }); },
    logout() { update(s => { s.user = null; }); },
    register(u) { let err = null; update(s => { s.accounts = s.accounts || []; const key = (u.email || '').toLowerCase(); if (s.accounts.find(a => a.email.toLowerCase() === key || a.phone === u.phone)) { err = 'An account with this email or phone already exists.'; return; } const acc = Object.assign({ since: String(new Date().getFullYear()) }, u, { email: key }); s.accounts.push(acc); const { pass, ...pub } = acc; s.user = pub; }); return err; },
    auth(id, pass) { let ok = false; update(s => { const k = (id || '').trim().toLowerCase(); const a = (s.accounts || []).find(x => x.email === k || x.phone === id.trim()); if (a && a.pass === pass) { const { pass: _, ...pub } = a; s.user = pub; ok = true; } }); return ok; },
    resetPass(id, pass) { let ok = false; update(s => { const k = (id || '').trim().toLowerCase(); const a = (s.accounts || []).find(x => x.email === k || x.phone === id.trim()); if (a) { a.pass = pass; ok = true; } }); return ok; },
    admins: () => (load().admins || []),
    adminUser: () => load().adminUser || null,
    adminLogin(id, pass) { let ok = false; update(s => { (s.admins || []).forEach(x => { if (!x.phone && x.email === 'admin@artradeinternational.com') x.phone = '01700000000'; }); const a = AR.adminMatch(s.admins || [], id); if (a && a.pass === pass && a.status === 'Active') { s.adminUser = { name: a.name, email: a.email, role: a.role }; ok = true; } }); return ok; },
    normPhone(p) { let n = String(p || '').replace(/\D/g, ''); if (n.startsWith('880')) n = n.slice(2); if (n.length === 10 && n[0] === '1') n = '0' + n; return n; },
    adminMatch(list, id) { const v = String(id || '').trim().toLowerCase(); if (v.includes('@')) return list.find(x => (x.email || '').toLowerCase() === v); const k = AR.normPhone(v); return k ? list.find(x => AR.normPhone(x.phone || (x.email === 'admin@artradeinternational.com' ? '01700000000' : '')) === k) : null; },
    adminFind(id) { return AR.adminMatch(load().admins || [], id); },
    adminRegister(d) { let err = null; const ph = AR.normPhone(d.phone); if (!/^01[3-9]\d{8}$/.test(ph)) return 'Enter a valid 11-digit mobile number (01XXXXXXXXX).'; update(s => { s.admins = (s.admins || []).filter(x => !(x.status === 'Pending' && ['new@b.com','a@b.com'].includes((x.email || '').toLowerCase()))); s.admins.forEach(x => { if (!x.phone && x.email === 'admin@artradeinternational.com') x.phone = '01700000000'; }); const k = (d.email || '').trim().toLowerCase(); if (!k || !k.includes('@')) { err = 'Enter a valid work email.'; return; } if (AR.adminMatch(s.admins, ph)) { err = 'This mobile number is already registered.'; return; } if (s.admins.find(a => (a.email || '').toLowerCase() === k)) { err = 'This email is already registered.'; return; } s.admins.push({ name: d.name, phone: ph, email: k, pass: d.pass, role: d.role || 'Staff', status: 'Pending', at: Date.now() }); }); return err; },
    setAdminStatus(email, st) { update(s => { const a = (s.admins || []).find(x => x.email === email); if (a) a.status = st; }); },
    adminLogout() { update(s => { s.adminUser = null; }); },
    compare: () => (load().compare || []),
    toggleCompare(id) { let full = false; update(s => { s.compare = s.compare || []; const i = s.compare.indexOf(id); if (i >= 0) s.compare.splice(i, 1); else if (s.compare.length >= 3) full = true; else s.compare.push(id); }); return !full; },
    clearCompare() { update(s => { s.compare = []; }); },
    saveProfile(u) { update(s => { const old = s.user || {}; s.user = Object.assign({}, old, u); const a = (s.accounts || []).find(x => (old.email && x.email === old.email) || (old.phone && x.phone === old.phone)); if (a) Object.assign(a, u); }); },
    loginOtp(phone) { update(s => { s.accounts = s.accounts || []; let a = s.accounts.find(x => x.phone === phone); if (!a) { a = { name: 'Customer ' + phone.slice(-4), phone, email: '', pass: '', area: 'inside', address: '', since: String(new Date().getFullYear()), via: 'Phone OTP' }; s.accounts.push(a); } const { pass: _, ...pub } = a; s.user = pub; }); },
    loginSocial(p) { update(s => { s.accounts = s.accounts || []; const email = p === 'Google' ? 'google.user@gmail.com' : 'facebook.user@fb.com'; let a = s.accounts.find(x => x.email === email); if (!a) { a = { name: p + ' User', phone: '', email, pass: '', area: 'inside', address: '', since: String(new Date().getFullYear()), via: p }; s.accounts.push(a); } const { pass: _, ...pub } = a; s.user = pub; }); },
    deleteAccount() { update(s => { const u = s.user || {}; s.accounts = (s.accounts || []).filter(x => !((u.email && x.email === u.email) || (u.phone && x.phone === u.phone))); s.user = null; }); },
    placeOrder(d) {
      const t = totals(d.area, d.coupon, d); let id = null;
      if (!t.lines.length) return null;
      update(s => {
        const n = s.orders.reduce((m, o) => Math.max(m, parseInt(o.id.slice(3), 10) || 0), 10480) + 1;
        id = 'AR-' + n; const now = Date.now();
        const items = t.lines.filter(l => l.chargeQty > 0).map(l => ({ id: l.id, qty: l.chargeQty, price: l.price, name: l.name, img: l.img, held: l.held, backorder: d.partial === 'drop' ? 0 : l.short }));
        const hold = t.heldN > 0;
        s.orders.unshift({ id, date: now, customer: d.customer, area: d.area, address: d.address, items, subtotal: t.subtotal, discount: t.discount, member: t.member, delivery: t.delivery, express: !!t.express, vat: t.vat, vatPct: t.vatPct, vatInvoice: !!d.vatInv, bin: d.bin || '', slot: d.slot || '', total: t.total, payment: d.payment, gateway: d.gateway || '', payStatus: d.paid ? 'Paid' : 'Unpaid', partial: t.shortN ? d.partial : '', hold, holdNote: hold ? 'High-value / special-order items held until our team approves them' : '', status: 'Pending', history: [{ s: 'Pending', at: now }], note: d.note || '' });
        t.lines.forEach(l => { const e = s.edits[l.id] || (s.edits[l.id] = {}); e.stock = Math.max(0, (e.stock != null ? e.stock : l.stock) - l.avail); });
        s.cart = {};
        if (!s.user) s.user = Object.assign({ since: String(new Date().getFullYear()), address: d.address, area: d.area }, d.customer);
      });
      return id;
    },
    order: id => load().orders.find(o => o.id === id),
    setOrderStatus(id, st) { update(s => { const o = s.orders.find(x => x.id === id); if (o && o.status !== st) { o.status = st; o.history.push({ s: st, at: Date.now() }); } }); },
    bookService(d) { let id; update(s => { id = 'SV-' + (2091 + s.services.length + 1); s.services.unshift(Object.assign({ id, status: 'New', created: Date.now() }, d)); }); return id; },
    setServiceStatus(id, st) { update(s => { const v = s.services.find(x => x.id === id); if (v) v.status = st; }); },
    editProduct(id, patch) { update(s => { s.edits[id] = Object.assign({}, s.edits[id] || {}, patch); }); },
    removeProduct(id) { update(s => { s.edits[id] = Object.assign({}, s.edits[id] || {}, { deleted: true }); }); },
    deleteOrder(id) { update(s => { s.orders = s.orders.filter(o => o.id !== id); }); },
    deleteMessage(i) { update(s => { s.messages.splice(i, 1); }); },
    visibleCats: () => CATS.filter(c => !load().settings.hiddenCats.includes(c.id)),
    addProduct(p) { update(s => { const id = 30000 + s.extra.length + 1; s.extra.push(Object.assign({ id, img: null, popular: false, isNew: true, active: true, extra: [], spec: '', tech: '', color: '', yield: '', part: '', compat: '' }, p)); }); },
    chat: () => (load().chat || []),
    chatSend(from, text) { update(s => { s.chat = s.chat || []; s.chat.push({ from, text, at: Date.now() }); }); },
    chatClear() { update(s => { s.chat = []; }); },
    message(m) { update(s => { s.messages.unshift(Object.assign({ at: Date.now() }, m)); }); },
    subscribe(e) { update(s => { s.subscribers = s.subscribers || []; if (e && !s.subscribers.includes(e)) s.subscribers.push(e); }); },
    unsubscribe(e) { update(s => { s.subscribers = (s.subscribers || []).filter(x => x !== e); (s.consents || []).forEach(c => { if (c.email === e && c.status !== 'Unsubscribed') { c.status = 'Unsubscribed'; c.unsubAt = Date.now(); } }); }); },
    optIn(email, source, page, ip) { let token = null; email = (email || '').trim().toLowerCase(); if (!email) return null; update(s => { s.consents = s.consents || []; const ex = s.consents.find(c => c.email === email && c.status !== 'Unsubscribed'); if (ex && ex.status === 'Confirmed') { token = ex.token; return; } token = 'OPT-' + Math.random().toString(36).slice(2, 10).toUpperCase(); s.consents.unshift({ email, source, page: page || '#/', ip: ip || 'unknown', ua: (navigator.userAgent || '').slice(0, 80), at: Date.now(), token, status: 'Pending', confirmedAt: null, mailSentAt: Date.now() }); }); return token; },
    confirmOptIn(token) { let ok = false; update(s => { const c = (s.consents || []).find(x => x.token === token); if (c) { c.status = 'Confirmed'; c.confirmedAt = c.confirmedAt || Date.now(); s.subscribers = s.subscribers || []; if (!s.subscribers.includes(c.email)) s.subscribers.push(c.email); ok = true; } }); return ok; },
    consents: () => load().consents || [],
    campaigns: () => load().campaigns || [],
    sendCampaign(c) { update(s => { s.campaigns = s.campaigns || []; s.campaigns.unshift(Object.assign({ id: 'CMP-' + (101 + s.campaigns.length + 1), at: Date.now() }, c)); }); },
    setAdminRole(email, role) { update(s => { const a = (s.admins || []).find(x => x.email === email); if (a) a.role = role; if (s.adminUser && s.adminUser.email === email) s.adminUser.role = role; }); },
    saveSettings(p) { update(s => { Object.assign(s.settings, p); }); },
    reset() { S = seed(); _pc = null; save(); window.dispatchEvent(new Event('ar:change')); },
    date: t => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    time: t => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  };

  const FLOW = ['Placed', 'Verification', 'Confirmed', 'Packed', 'Out for delivery', 'Delivered'];
  const LEGACY = { 'Placed': 'Pending', 'Verification': 'Pending', 'Confirmed': 'Confirmed', 'Packed': 'Packed', 'Out for delivery': 'Shipped', 'Delivered': 'Delivered', 'Cancelled': 'Cancelled', 'Returned': 'Cancelled' };
  const RIDERS = [
    { id: 'R1', name: 'Rafiq Hasan', phone: '01711-450012', vehicle: 'Motorbike · DHA-LA 22-4417', branch: 'B1', rating: 4.9 },
    { id: 'R2', name: 'Sumon Mia', phone: '01819-662210', vehicle: 'Motorbike · DHA-HA 13-9021', branch: 'B2', rating: 4.8 },
    { id: 'R3', name: 'Jahid Khan', phone: '01912-330478', vehicle: 'Motorbike · DHA-LA 31-1180', branch: 'B3', rating: 4.7 },
    { id: 'R4', name: 'Arif Hossain', phone: '01675-118833', vehicle: 'Cargo van · DHA-NA 11-2045', branch: 'B1', rating: 4.9 }
  ];
  const BRANCHES = [
    { id: 'B1', name: 'Shantinagar HQ', area: 'Central Dhaka', keys: ['shantinagar', 'motijheel', 'malibagh', 'paltan', 'ramna', 'dhanmondi', 'segunbagicha'] },
    { id: 'B2', name: 'Mirpur branch', area: 'Mirpur · Mohammadpur', keys: ['mirpur', 'mohammadpur', 'pallabi', 'kafrul', 'agargaon'] },
    { id: 'B3', name: 'Uttara branch', area: 'Uttara · Airport · Banani', keys: ['uttara', 'airport', 'banani', 'gulshan', 'baridhara', 'tongi'] },
    { id: 'B4', name: 'Chattogram depot', area: 'Chattogram division', keys: ['chattogram', 'chittagong', 'agrabad', 'cox'] }
  ];
  const COURIERS = [
    { id: 'Pathao', color: '#e11b22', eta: '1–2 days', fee: 120 },
    { id: 'RedX', color: '#d6232a', eta: '2–3 days', fee: 110 },
    { id: 'Steadfast', color: '#00a651', eta: '2–3 days', fee: 100 }
  ];
  const RETURN_REASONS = ['Damaged in transit', 'Wrong item delivered', 'Defective / leaking cartridge', 'Expired or old stock', 'Changed my mind'];
  const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 9973; return h; };
  function flowOf(o) { if (o.flow) return o.flow; return o.status === 'Pending' ? 'Placed' : o.status === 'Shipped' ? 'Out for delivery' : o.status; }
  function branchStock(pid, bid) { const p = find(pid); const st = p ? (p.stock || 0) : 0; if (bid === 'B1') return st; return hash(pid + bid) % (st + 2); }
  function routeBranch(o) {
    const addr = (o.address || '').toLowerCase();
    const near = BRANCHES.find(b => b.keys.some(k => addr.includes(k))) || BRANCHES[0];
    const order = [near].concat(BRANCHES.filter(b => b !== near));
    const ok = b => (o.items || []).every(i => branchStock(i.id, b.id) >= i.qty);
    const pick = order.find(ok) || BRANCHES[0];
    return { near, pick, fallback: pick !== near, stock: BRANCHES.map(b => ({ b, ok: ok(b) })) };
  }
  function upd(id, fn) { update(s => { const o = s.orders.find(x => x.id === id); if (o) fn(o, s); }); }
  function pushFlow(o, st, note) { o.flow = st; o.status = LEGACY[st] || o.status; o.flowHist = o.flowHist || [{ s: 'Placed', at: o.date }]; o.flowHist.push({ s: st, at: Date.now(), note: note || '' }); o.history = o.history || []; o.history.push({ s: o.status, at: Date.now() }); }
  (function migrate() { const s = load(); let ch = false; s.orders.forEach((o, i) => { if (flowOf(o) === 'Out for delivery' && !o.rider && !o.courier) { o.rider = RIDERS[i % RIDERS.length].id; o.outAt = o.outAt || Date.now() - 12 * 6e4; o.otp = o.otp || String(1000 + hash(o.id) % 9000); o.branch = o.branch || 'B1'; ch = true; } }); if (ch) save(); })();
  Object.assign(AR, {
    FLOW, RIDERS, BRANCHES, COURIERS, RETURN_REASONS, flowOf, routeBranch, branchStock,
    rider: id => RIDERS.find(r => r.id === id), branch: id => BRANCHES.find(b => b.id === id),
    setFlow(id, st, note) { upd(id, o => { if (flowOf(o) === st) return; if (st === 'Packed' && !o.branch) o.branch = routeBranch(o).pick.id; if (st === 'Out for delivery') { o.outAt = Date.now(); o.otp = o.otp || String(1000 + hash(o.id + Date.now()) % 9000); } pushFlow(o, st, note); }); },
    assignRider(id, rid) { upd(id, o => { o.rider = rid || null; if (rid) o.courier = null; if (rid && flowOf(o) === 'Out for delivery') { o.outAt = o.outAt || Date.now(); o.otp = o.otp || String(1000 + hash(o.id + rid) % 9000); } }); },
    assignCourier(id, cid) { upd(id, o => { o.courier = cid ? { id: cid, tn: cid.slice(0, 2).toUpperCase() + (100000 + hash(o.id + cid) * 37 % 900000), at: Date.now() } : null; if (cid) o.rider = null; }); },
    setBranch(id, bid) { upd(id, o => { o.branch = bid; }); },
    failAttempt(id, reason) { upd(id, o => { o.attempts = (o.attempts || []).concat([{ reason, at: Date.now() }]); o.flowHist = (o.flowHist || []).concat([{ s: 'Attempt failed', at: Date.now(), note: reason }]); }); },
    completeDelivery(id, pod) { let err = null; upd(id, o => { if (pod.method === 'otp' && !o.otp) o.otp = pod.otp; if (pod.method === 'otp' && String(pod.otp).trim() !== String(o.otp)) { err = 'OTP does not match'; return; } o.pod = Object.assign({ at: Date.now() }, pod); if (pod.cod) { o.codCollected = o.total; o.payStatus = 'Paid'; } pushFlow(o, 'Delivered', pod.method === 'courier' ? 'Confirmed by ' + ((o.courier || {}).id || 'courier') : pod.method === 'otp' ? 'OTP verified' : 'Signed by ' + (pod.name || 'customer')); }); return err; },
    cancelOrder(id, note) { upd(id, o => pushFlow(o, 'Cancelled', note)); },
    returnEligible(o, reason) { const days = (Date.now() - ((o.pod && o.pod.at) || o.date)) / 864e5; if (flowOf(o) !== 'Delivered') return { ok: false, why: 'Only delivered orders can be returned.' }; if (days > 7) return { ok: false, why: 'Return window (7 days) has passed.' }; if (reason === 'Changed my mind') return { ok: false, why: 'Opened toner, ink and consumables are non-returnable unless damaged, wrong, defective or expired.' }; return { ok: true, why: 'Eligible — full refund or replacement after inspection.' }; },
    requestReturn(id, reason, note) { upd(id, o => { o.ret = { reason, note: note || '', status: 'Requested', at: Date.now() }; }); },
    resolveReturn(id, approve, mode) { upd(id, o => { if (!o.ret) return; o.ret.status = approve ? 'Approved' : 'Rejected'; o.ret.mode = mode || 'Refund'; o.ret.doneAt = Date.now(); if (approve) { o.ret.refund = o.total; pushFlow(o, 'Returned', (mode || 'Refund') + ' · ' + o.ret.reason); } }); },
    codByRider() { const m = {}; load().orders.forEach(o => { if (o.rider && o.codCollected && !o.codDeposited) m[o.rider] = (m[o.rider] || 0) + o.codCollected; }); return m; },
    depositCod(rid) { update(s => { s.orders.forEach(o => { if (o.rider === rid && o.codCollected) o.codDeposited = Date.now(); }); }); }
  });
  window.AR = AR;
  window.dispatchEvent(new Event('ar:ready'));
})();
