import Reset from './pages/Reset.jsx';
import { Blog, BlogPost } from './pages/Blog.jsx';
import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { useStore } from './store.jsx';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Chat from './components/Chat.jsx';
import { ForbiddenPage, LoadFailedPage, MaintenancePage, OfflinePage, ServerErrorPage } from './pages/ErrorPages.jsx';
import { CartDrawer, CompareBar, LoginModal, NewsletterPopup, OptInMail, PromoPopup, Toast } from './components/Overlays.jsx';
import Home from './pages/Home.jsx';
import Shop from './pages/Shop.jsx';
import Product from './pages/Product.jsx';
import { Cart, Checkout, Success } from './pages/Cart.jsx';
import Account from './pages/Account.jsx';
import { Compare, Wishlist } from './pages/Lists.jsx';
import Track from './pages/Track.jsx';
import Services, { ServiceDetail } from './pages/Services.jsx';
import { Careers, Job } from './pages/Careers.jsx';
import { About, Contact, Faq, NotFound, Offers, Policy } from './pages/Info.jsx';

const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));
const HubApp = lazy(() => import('./hub/HubApp.jsx'));
const EmailApp = lazy(() => import('./email/EmailApp.jsx'));
const Prefs = lazy(() => import('./pages/Prefs.jsx'));

export default function App() {
  const { data, error } = useStore();
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  const spin = <div style={{ padding: 80, textAlign: 'center' }}><span className="spin" /></div>;
  const errorScreens = { '/server-error': <ServerErrorPage />, '/forbidden': <ForbiddenPage />, '/maintenance': <MaintenancePage />, '/offline': <OfflinePage /> };
  if (errorScreens[pathname]) return errorScreens[pathname];
  if (pathname.startsWith('/prefs/')) return <Suspense fallback={spin}><Routes><Route path="/prefs/:token" element={<Prefs />} /></Routes></Suspense>;
  if (pathname.startsWith('/email')) return <Suspense fallback={spin}><Routes><Route path="/email/*" element={<EmailApp />} /></Routes></Suspense>;
  if (pathname.startsWith('/hub')) return <Suspense fallback={<div style={{ padding: 80, textAlign: 'center' }}><span className="spin" /></div>}><Routes><Route path="/hub/*" element={<HubApp />} /></Routes></Suspense>;
  if (pathname.startsWith('/admin')) return <Suspense fallback={<div style={{ padding: 80, textAlign: 'center' }}><span className="spin" /></div>}><Routes><Route path="/admin/*" element={<AdminApp />} /></Routes></Suspense>;
  if (error) return <LoadFailedPage />;
  if (!data) return <div style={{ padding: 80, textAlign: 'center' }}><span className="spin" /></div>;

  return (
    <>
    <div className="site">
      <Header />
      <main style={{ flex: 1, width: '100%' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Home />} />
          <Route path="/reset/:token" element={<Reset />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/shop/:cat" element={<Shop />} />
          <Route path="/product/:id" element={<Product />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/success/:id" element={<Success />} />
          <Route path="/account/*" element={<Account />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/track" element={<Track />} />
          <Route path="/services" element={<Services />} />
          <Route path="/services/:slug" element={<ServiceDetail />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/careers/:id" element={<Job />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/offers" element={<Offers />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/policy/:key" element={<Policy />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
    <CartDrawer /><PromoPopup /><NewsletterPopup /><OptInMail /><LoginModal /><CompareBar /><Chat /><Toast />
    </>
  );
}
