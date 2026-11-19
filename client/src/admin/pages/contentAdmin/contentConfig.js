/** Static configuration of the content manager: slide field list, tab icons and tab titles. */
const notImage = s => s.type !== 'image';
const isImage = s => s.type === 'image';

export const SLIDE_FIELDS = [
  { k: 'on', type: 'check', label: 'Show this slide' },
  { k: 'type', type: 'select', label: 'Slide style', options: [['image', 'Banner image (full)'], ['design', 'Text + product picture']] },
  { k: 'img', type: 'image', label: 'Banner image', folder: 'slides', wide: true, show: isImage },
  { k: 'alt', label: 'Banner title (for accessibility)', show: isImage },
  { k: 'href', label: 'Opens (e.g. #/shop/toner)', show: isImage },
  { k: 'tag', label: 'Small tag line', show: notImage },
  { k: 'title', label: 'Headline', show: notImage, ph: 'or {heroTitle} for the Settings text' },
  { k: 'sub', type: 'area', label: 'Sub text', rows: 2, show: notImage },
  { k: 'c1', label: 'Button 1 text', show: notImage }, { k: 'h1', label: 'Button 1 link', show: notImage },
  { k: 'c2', label: 'Button 2 text', show: notImage }, { k: 'h2', label: 'Button 2 link', show: notImage },
  { k: 'pic', type: 'image', label: 'Product picture', folder: 'slides', show: notImage },
  { k: 'badgeT', label: 'Badge top text', show: notImage }, { k: 'badgeV', label: 'Badge value', show: notImage }
];

export const TAB_ICON = { slides: '🖼️', brands: '🏷️', clients: '🏢', perks: '✨', faqs: '❓', policies: '📜', about: 'ℹ️', menus: '🔗', general: '✎' };
/** [key, tab label, one-line description]. */
export const TABS = [
  ['slides', 'Home slider', 'The big banner on the home page. Order = display order.'],
  ['brands', 'Brand logos', 'The scrolling brand strip on the home page.'],
  ['clients', 'Client logos', 'Corporate clients on the About page.'],
  ['perks', 'Home highlights', 'The four icon cards under the slider.'],
  ['faqs', 'FAQs', 'Frequently asked questions page.'],
  ['policies', 'Policies', 'Privacy, terms, returns and shipping pages.'],
  ['about', 'About page', 'Introduction, Managing Director message, vision, mission, numbers and "why choose us" cards.'],
  ['menus', 'Menus & footer', 'Links in the Hot Products, Our Services and Blog dropdowns, the footer About column, and footer / contact texts.'],
  ['general', 'Texts & links', 'Section titles, social links and the search-box typing hints.']
];
