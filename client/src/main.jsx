import './visit.js';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { ErrorBoundary } from './pages/ErrorPages.jsx';
import { StoreProvider } from './store.jsx';
import './styles.css';
import './styles/policy-footer-rails.css';
import './styles/popups-toasts.css';
import './styles/error-pages-loader.css';
import './styles/live-search-clients.css';
import './styles/mobile-nav.css';
import './styles/pd-best-sellers.css'; // shared bits (the chat button, best sellers on the home page); the rest of the product-page styles load with the product page
import './blog.css';
import './flat.css';

createRoot(document.getElementById('root')).render(
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <ErrorBoundary><StoreProvider><App /></StoreProvider></ErrorBoundary>
  </BrowserRouter>
);

// hide the splash once the app has painted (at least ~1.2s so it does not flash), first visit per session only
const splash = document.getElementById('splash');
if (splash) {
  const born = performance.now();
  const hide = () => setTimeout(() => {
    splash.classList.add('out');
    try { sessionStorage.setItem('arSplash', '1'); } catch { /* private mode */ }
    setTimeout(() => splash.remove(), 700);
  }, Math.max(0, 1200 - (performance.now() - born)));
  if (document.readyState === 'complete') hide(); else window.addEventListener('load', hide);
}
