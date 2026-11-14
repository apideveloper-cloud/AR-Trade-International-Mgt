import './cart.css'; // styles for the cart, checkout and order-placed pages (the modules in ./checkout/ rely on it)
// Thin entry point: App.jsx lazy-loads `Cart`, `Checkout` and `Success` from here. The code lives in ./checkout/.
export { default as Cart } from './checkout/CartPage.jsx';
export { default as Checkout } from './checkout/CheckoutPage.jsx';
export { default as Success } from './checkout/SuccessPage.jsx';
