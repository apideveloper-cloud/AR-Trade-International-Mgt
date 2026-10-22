// Static navigation and presentation data copied from the design (AR Trade Store.dc.html)
export const LOGO = '/api/uploads/site/artrade-logo.png';

export const MEGA = [
  { t: 'Computer', c: 'computer', items: [['Brand PC', 'PC'], ['AR Clone PC', 'Clone'], ['Laptop', 'Laptop'], ['Notebook', 'Notebook'], ['Laptop Tablet', 'Tablet'], ['Monitor', 'Monitor']] },
  { t: 'Printer Machine', c: 'printer', items: [['Laser · Black & White', 'Laser'], ['Laser · Color', 'Color'], ['Inkjet Printer', 'Inkjet'], ['Dot Printer', 'Dot'], ['Pantum', 'Pantum'], ['Brother', 'Brother']] },
  { t: 'Toner & Cartridge', c: 'toner', items: [['All Laser Toner', ''], ['HP', 'HP'], ['Canon', 'Canon'], ['Samsung', 'Samsung'], ['Brother', 'Brother'], ['Pantum', 'Pantum']] },
  { t: 'Ink & Ribbon', c: 'ink', items: [['All Ink Cartridge', ''], ['HP', 'HP'], ['Canon', 'Canon'], ['Epson', 'Epson'], ['Epson Ribbon', 'Ribbon']] },
  { t: 'Photocopier Toner', c: 'copier-toner', items: [['All Photocopier Toner', ''], ['Toshiba', 'Toshiba'], ['Canon', 'Canon'], ['Sharp', 'Sharp'], ['Ricoh', 'Ricoh']] },
  { t: 'Photocopier Machine', c: 'copier', items: [['All Photocopier', ''], ['HP', 'HP'], ['Toshiba', 'Toshiba'], ['Canon', 'Canon'], ['Sharp', 'Sharp'], ['Ricoh', 'Ricoh'], ['Drum Unit', 'Drum']] },
  { t: 'Scanner', c: 'scanner', items: [['All Scanner', ''], ['HP', 'HP'], ['Canon', 'Canon'], ['Epson', 'Epson']] },
  { t: 'Network Accessories', c: 'network', items: [['Router', 'Router'], ['Networking Switch', 'Switch'], ['LAN Card', 'LAN'], ['Cable', 'Cable']] },
  { t: 'Security Camera', c: 'camera', items: [['IP Camera', 'IP'], ['IR Camera', 'IR'], ['Wi-Fi Camera', 'WiFi'], ['DVR · NVR · XVR', 'VR'], ['Camera Accessories', 'Accessor']] },
  { t: 'Spare Parts', c: 'parts', items: [['Printer Replacement Parts', 'Printer'], ['Copier Replacement Parts', 'Copier']] },
  { t: 'All Accessories', c: 'computer', items: [['Motherboard', 'Motherboard'], ['Processor', 'Processor'], ['RAM', 'RAM'], ['Hard Disk', 'Hard'], ['Keyboard & Mouse', 'Keyboard'], ['Casing', 'Casing']] }
];

const int = (t, to) => ({ t, to });
const ext = (t, href) => ({ t, href, mark: '↗' });
export const MENUS = [
  { t: 'Office Equipment', mega: true },
  // main / popular product categories: their dropdown (all products + top brands) is built from the live catalogue in Header.jsx
  { t: 'Toner', cat: 'toner', path: '/shop/toner' },
  { t: 'Ink', cat: 'ink', path: '/shop/ink' },
  { t: 'Printers', cat: 'printer', path: '/shop/printer' },
  { t: 'Photocopiers', cat: 'copier', path: '/shop/copier' },
  { t: 'Hot Products', k: 'hot', items: [int('Laser Toner', '/shop/toner'), int('Copier Toner', '/shop/copier-toner'), int('New Offer', '/offers')] },
  { t: 'Our Services', k: 'services', items: [ext('Website Design & Development', 'https://aritfirm.net/static-website/'), ext('Digital Marketing Services', 'https://aritfirm.net/digital-marketing/'), ext('Software Development', 'https://aritsoft.com/'), ext('Domain & Hosting Service', 'https://secure.aritfirm.net')] },
  { t: 'Blog', k: 'blog', path: '/blog', items: [int('All articles', '/blog'), int('Toner guides', '/blog?cat=Toner'), int('Printer guides', '/blog?cat=Printers'), int('Accessories', '/blog?cat=Accessories'), int('Computer & IT', '/blog?cat=Computer')] }
];

/** About Us links, shown in the footer instead of the menu bar. */
export const ABOUT_LINKS = [int('Message from Managing Director', '/about'), int('Company Profile', '/about'), int('Vision and Mission', '/about'), ext('Our Corporate Clients', 'https://artradeinternational.com/our-clients/'), int('Our All Product Catalog', '/shop/all'), ext('Our Team', 'https://artradeinternational.com/our-team/'), ext('Our Events', 'https://artradeinternational.com/our-events/'), int('Careers', '/careers')];

export const CAT_TINT = { toner: 220, 'copier-toner': 350, ink: 300, printer: 85, copier: 258, computer: 200, scanner: 150, camera: 25, network: 180, parts: 60 };
export const CAT_FALLBACK = {
  computer: '/api/uploads/site/category-computer.jpg',
  scanner: '/api/uploads/site/category-scanner.jpg',
  network: '/api/uploads/site/category-network.jpg',
  parts: '/api/uploads/site/category-parts.jpg',
  copier: '/api/uploads/site/canon-imagerunner-ir2206-monochrome-a3-laser-multifunctional-photocopier.png',
  camera: '/api/uploads/site/avtech-avm-2200.jpg'
};
const PHOTO = ['computer', 'scanner', 'network', 'parts'];
export const isPhoto = id => PHOTO.includes(id);

export const SVC_IMGS = [
  '/api/uploads/site/repair.jpg',
  '/api/uploads/site/service4.jpg',
  '/api/uploads/site/printer-networking.jpg'
];

export const PAY = [
  ['COD', 'Cash on delivery', 'Pay when it arrives', ['৳ COD', '11px', 'linear-gradient(135deg,oklch(0.62 0.15 150),oklch(0.5 0.14 155))']],
  ['bKash', 'bKash', 'Instant wallet payment', ['bKash', '12px', 'linear-gradient(135deg,#e2136e,#c10d5d)', '/api/uploads/site/pay-bkash.webp']],
  ['Nagad', 'Nagad', 'Instant wallet payment', ['নগদ', '13px', 'linear-gradient(135deg,#f7941d,#ec1c24)', '/api/uploads/site/pay-nagad.webp']],
  ['Rocket', 'Rocket', 'DBBL mobile banking', ['Rocket', '11px', 'linear-gradient(135deg,#8c3494,#5b1f63)', '/api/uploads/site/pay-rocket.webp']],
  ['Card', 'Card', 'Visa · Mastercard · Amex', ['VISA', '12px', 'linear-gradient(135deg,#1a1f71,#2b4bb5)']],
  ['Bank', 'Bank transfer', 'Corporate orders', ['BANK', '11px', 'linear-gradient(135deg,#16213f,#0b1631)', '/api/uploads/site/pay-bank.webp']]
];
export const PAY_HERO = {
  bKash: 'linear-gradient(135deg,oklch(0.62 0.22 350),oklch(0.5 0.2 355))', Nagad: 'linear-gradient(135deg,oklch(0.7 0.19 45),oklch(0.58 0.21 30))',
  Rocket: 'linear-gradient(135deg,oklch(0.55 0.2 310),oklch(0.42 0.18 300))', Card: 'linear-gradient(135deg,oklch(0.55 0.15 245),#0b1631)'
};
export const PAY_LABEL = { COD: 'Cash on delivery', Bank: 'Bank transfer' };
export const SLOT_TIMES = ['10am – 1pm', '1pm – 4pm', '4pm – 8pm'];

/** Editable in Admin > Site content. These are the defaults used until an admin saves their own text. */
export const DEFAULT_ABOUT = {
  heading: 'Office technology for Bangladesh, since 2011.',
  intro: 'Founded by a group of experienced engineers, AR Trade International set up its head office in Dhaka in 2011 selling computer equipment, printers, photocopiers, toner and cartridges. Today we are a family of 40+ people serving homes, offices, banks, NGOs and government institutions.',
  mdMessage: '“We treat client satisfaction as our core mission. We develop products and provide services to satisfy the needs of our valued customers — we exist because of their support.”',
  mdName: 'Md Amir Hossain', mdTitle: 'Managing Director',
  vision: 'Help businesses and institutions across Bangladesh run on reliable, genuine technology — and grow the skills to use it well.',
  mission: 'Serve public and private sector customers — production, trade, banks, government and NGOs — with modern technology products and dependable support.'
};
export const DEFAULT_FOOTER = {
  tagline: 'Computers, printers, photocopiers and genuine toner for businesses across Bangladesh, since 2011.',
  hours: 'Sat–Thu · 10:00–20:00',
  mobileBanking: 'bKash · Nagad · Upay: 01929-360846',
  email2: 'artrade46@gmail.com'
};
/** Links in the three text dropdowns of the menu bar and the footer "About us" column. */
export const DEFAULT_MENUS = {
  hot: MENUS.find(m => m.t === 'Hot Products').items,
  services: MENUS.find(m => m.t === 'Our Services').items,
  blog: MENUS.find(m => m.t === 'Blog').items,
  about: ABOUT_LINKS
};

/** Defaults + saved values, where a blank saved value falls back to the default (so an empty field never blanks the page). */
export const withDefaults = (def, saved) => Object.fromEntries(Object.entries(def).map(([k, v]) => [k, saved && String(saved[k] ?? '').trim() ? saved[k] : v]));
