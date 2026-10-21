// Static navigation and presentation data copied from the design (AR Trade Store.dc.html)
export const LOGO = 'https://artradeinternational.com/wp-content/uploads/2019/09/artrade-logo.png';

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
  { t: 'Hot Products', items: [int('Laser Toner', '/shop/toner'), int('Copier Toner', '/shop/copier-toner'), int('New Offer', '/offers')] },
  { t: 'Our Services', items: [ext('Website Design & Development', 'https://aritfirm.net/static-website/'), ext('Digital Marketing Services', 'https://aritfirm.net/digital-marketing/'), ext('Software Development', 'https://aritsoft.com/'), ext('Domain & Hosting Service', 'https://secure.aritfirm.net')] },
  { t: 'Blog', path: '/blog', items: [int('All articles', '/blog'), int('Toner guides', '/blog?cat=Toner'), int('Printer guides', '/blog?cat=Printers'), int('Accessories', '/blog?cat=Accessories'), int('Computer & IT', '/blog?cat=Computer')] }
];

/** About Us links, shown in the footer instead of the menu bar. */
export const ABOUT_LINKS = [int('Message from Managing Director', '/about'), int('Company Profile', '/about'), int('Vision and Mission', '/about'), ext('Our Corporate Clients', 'https://artradeinternational.com/our-clients/'), int('Our All Product Catalog', '/shop/all'), ext('Our Team', 'https://artradeinternational.com/our-team/'), ext('Our Events', 'https://artradeinternational.com/our-events/'), int('Careers', '/careers')];

export const CAT_TINT = { toner: 220, 'copier-toner': 350, ink: 300, printer: 85, copier: 258, computer: 200, scanner: 150, camera: 25, network: 180, parts: 60 };
export const CAT_FALLBACK = {
  computer: 'https://images.unsplash.com/photo-1587831990711-23ca6441447b?w=600&q=70&auto=format&fit=crop',
  scanner: 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=600&q=70&auto=format&fit=crop',
  network: 'https://images.unsplash.com/photo-1606904825846-647eb07f5be2?w=600&q=70&auto=format&fit=crop',
  parts: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=70&auto=format&fit=crop',
  copier: 'https://artradeinternational.com/wp-content/uploads/2018/09/Canon-imageRUNNER-IR2206-Monochrome-A3-Laser-Multifunctional-Photocopier.png',
  camera: 'https://artradeinternational.com/wp-content/uploads/2019/03/Avtech-AVM-2200.jpg'
};
const PHOTO = ['computer', 'scanner', 'network', 'parts'];
export const isPhoto = id => PHOTO.includes(id);

export const SVC_IMGS = [
  'https://artradeinternational.com/wp-content/uploads/2019/07/repair.jpg',
  'https://artradeinternational.com/wp-content/uploads/2018/12/service4.jpg',
  'https://artradeinternational.com/wp-content/uploads/2019/07/Printer-Networking.jpg'
];

export const PAY = [
  ['COD', 'Cash on delivery', 'Pay when it arrives', ['৳ COD', '11px', 'linear-gradient(135deg,oklch(0.62 0.15 150),oklch(0.5 0.14 155))']],
  ['bKash', 'bKash', 'Instant wallet payment', ['bKash', '12px', 'linear-gradient(135deg,#e2136e,#c10d5d)']],
  ['Nagad', 'Nagad', 'Instant wallet payment', ['নগদ', '13px', 'linear-gradient(135deg,#f7941d,#ec1c24)']],
  ['Rocket', 'Rocket', 'DBBL mobile banking', ['Rocket', '11px', 'linear-gradient(135deg,#8c3494,#5b1f63)']],
  ['Card', 'Card', 'Visa · Mastercard · Amex', ['VISA', '12px', 'linear-gradient(135deg,#1a1f71,#2b4bb5)']],
  ['Bank', 'Bank transfer', 'Corporate orders', ['BANK', '11px', 'linear-gradient(135deg,#16213f,#0b1631)']]
];
export const PAY_HERO = {
  bKash: 'linear-gradient(135deg,oklch(0.62 0.22 350),oklch(0.5 0.2 355))', Nagad: 'linear-gradient(135deg,oklch(0.7 0.19 45),oklch(0.58 0.21 30))',
  Rocket: 'linear-gradient(135deg,oklch(0.55 0.2 310),oklch(0.42 0.18 300))', Card: 'linear-gradient(135deg,oklch(0.55 0.15 245),#0b1631)'
};
export const PAY_LABEL = { COD: 'Cash on delivery', Bank: 'Bank transfer' };
export const SLOT_TIMES = ['10am – 1pm', '1pm – 4pm', '4pm – 8pm'];
