import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { ErrorBoundary } from './pages/ErrorPages.jsx';
import { StoreProvider } from './store.jsx';
import './styles.css';
import './account.css';
import './product.css';
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
    try { sessionStorage.setItem('arSplash', '1'); } catch (e) { /* private mode */ }
    setTimeout(() => splash.remove(), 700);
  }, Math.max(0, 1200 - (performance.now() - born)));
  if (document.readyState === 'complete') hide(); else window.addEventListener('load', hide);
}
