// Who generated an order. Customer = the customer placed it on the website; the others are staff taking an order for a customer.
export const SOURCES = [
  { key: 'Customer', icon: '☺', hint: 'Placed on the website by the customer', tone: 'off', staff: false },
  { key: 'Call center', icon: '☎', hint: 'Taken by phone by a call center agent', tone: 'blue', staff: true },
  { key: 'Admin', icon: '◆', hint: 'Entered by an admin or manager', tone: 'violet', staff: true },
  { key: 'Seller', icon: '⚑', hint: 'Taken by a seller or field officer', tone: 'amber', staff: true }
];
export const SOURCE_TONE = Object.fromEntries(SOURCES.map(s => [s.key, s.tone]));
/** The generated-by choice that fits a staff role best (the form still lets them change it). */
export const sourceFor = role => (role === 'Call center agent' ? 'Call center' : role === 'RM' || role === 'Field Officer' ? 'Seller' : 'Admin');
