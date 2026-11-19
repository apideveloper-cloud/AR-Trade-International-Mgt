/** Order status flow shown as the progress stepper. */
export const FLOW = ['Placed', 'Verification', 'Confirmed', 'Packed', 'Out for delivery', 'Delivered'];

/** Colour per order status (also used by Dispatch and RiderApp). */
export const FLOW_COLOR = { Placed: '#7a869f', Verification: 'oklch(0.72 0.14 75)', Confirmed: 'oklch(0.55 0.16 255)', Packed: 'oklch(0.52 0.17 295)', 'Out for delivery': 'oklch(0.6 0.12 200)', Delivered: 'oklch(0.58 0.15 150)', Cancelled: 'oklch(0.58 0.19 20)', Returned: 'oklch(0.6 0.18 350)', 'Attempt failed': 'oklch(0.7 0.15 55)' };
