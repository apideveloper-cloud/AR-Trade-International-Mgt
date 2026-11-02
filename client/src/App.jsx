import { Suspense, useEffect } from 'react';
import { lazyPage } from './lazyPage.js';
import { Route, Routes, useLocation } from 'react-router-dom';
import { PageLoader } from './components/PageLoader.jsx';
import { useStore } from './store.jsx';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Chat from './components/Chat.jsx';
import { ForbiddenPage, LoadFailedPage, MaintenancePage, OfflinePage, ServerErrorPage } from './pages/ErrorPages.jsx';
import { CartDrawer, CompareBar, LoginModal, NewsletterPopup, OptInMail, PromoPopup, Toast } from './components/Overlays.jsx';
import Home from './pages/Home.jsx';
import { NotFound } from './pages/Info.jsx';

/** Pages other than the Home page load on demand, so the first visit downloads only what it needs. */
const page = lazyPage;
const Reset = page(() => import('./pages/Reset.jsx'));
const Blog = page(() => import('./pages/Blog.jsx'), 'Blog');
const BlogPost = page(() => import('./pages/Blog.jsx'), 'BlogPost');
const Shop = page(() => import('./pages/Shop.jsx'));
const Product = page(() => import('./pages/Product.jsx'));
const Cart = page(() => import('./pages/Cart.jsx'), 'Cart');
const Checkout = page(() => import('./pages/Cart.jsx'), 'Checkout');
const Success = page(() => import('./pages/Cart.jsx'), 'Success');
const Account = page(() => import('./pages/Account.jsx'));
const Wishlist = page(() => import('./pages/Lists.jsx'), 'Wishlist');
const Compare = page(() => import('./pages/Lists.jsx'), 'Compare');
const Track = page(() => import('./pages/Track.jsx'));
const Services = page(() => import('./pages/Services.jsx'));
const ServiceDetail = page(() => import('./pages/Services.jsx'), 'ServiceDetail');
const Careers = page(() => import('./pages/Careers.jsx'), 'Careers');
const Job = page(() => import('./pages/Careers.jsx'), 'Job');
const Offers = page(() => import('./pages/Info.jsx'), 'Offers');
const About = page(() => import('./pages/Info.jsx'), 'About');
const Contact = page(() => import('./pages/Info.jsx'), 'Contact');
const Faq = page(() => import('./pages/Info.jsx'), 'Faq');
const Policy = page(() => import('./pages/Info.jsx'), 'Policy');

const AdminApp = lazyPage(() => import('./admin/AdminApp.jsx'));
const HubApp = lazyPage(() => import('./hub/HubApp.jsx'));
const EmailApp = lazyPage(() => import('./email/EmailApp.jsx'));
const Prefs = lazyPage(() => import('./pages/Prefs.jsx'));

export default function App() {
  const { data, error } = useStore();
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  const spin = <PageLoader label="Loading…" />;
  const errorScreens = { '/server-error': <ServerErrorPage />, '/forbidden': <ForbiddenPage />, '/maintenance': <MaintenancePage />, '/offline': <OfflinePage /> };
  if (errorScreens[pathname]) return errorScreens[pathname];
  if (pathname.startsWith('/prefs/')) return <Suspense fallback={spin}><Routes><Route path="/prefs/:token" element={<Prefs />} /></Routes></Suspense>;
  if (pathname.startsWith('/email')) return <Suspense fallback={spin}><Routes><Route path="/email/*" element={<EmailApp />} /></Routes></Suspense>;
  if (pathname.startsWith('/hub')) return <Suspense fallback={<PageLoader label="Opening the Delivery Hub…" />}><Routes><Route path="/hub/*" element={<HubApp />} /></Routes></Suspense>;
  if (pathname.startsWith('/admin')) return <Suspense fallback={<PageLoader label="Opening the admin console…" />}><Routes><Route path="/admin/*" element={<AdminApp />} /></Routes></Suspense>;
  if (error) return <LoadFailedPage />;
  if (!data) return <PageLoader label="Loading the store…" />;

  return (
    <>
    <div className="site">
      <Header />
      <main style={{ flex: 1, width: '100%' }}>
        <Suspense fallback={<PageLoader inline label="Loading…" />}>
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
        </Suspense>
      </main>
      <Footer />
    </div>
    <CartDrawer /><PromoPopup /><NewsletterPopup /><OptInMail /><LoginModal /><CompareBar /><Chat /><Toast />
    </>
  );
}
