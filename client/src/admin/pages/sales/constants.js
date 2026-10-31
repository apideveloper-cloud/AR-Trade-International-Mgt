// Order statuses, quick remarks per status, delivery areas and payment methods used by the Orders pages.
export const STATUSES = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];
export const QUICK = { Pending: ['Back to pending, waiting for the customer'], Confirmed: ['Customer confirmed by phone', 'Stock checked and confirmed'], Packed: ['Packed and ready for pickup'], Shipped: ['Handed to the rider / courier'], Delivered: ['Delivered to the customer', 'Delivered and cash collected'], Cancelled: ['Customer asked to cancel', 'Out of stock', 'Could not reach the customer'] };
export const AREA = { inside: 'Inside Dhaka', suburb: 'Dhaka suburbs', outside: 'Outside Dhaka' };
export const PAYMENTS = ['bKash', 'Nagad', 'Rocket', 'Card', 'Cash on delivery', 'Bank'];
