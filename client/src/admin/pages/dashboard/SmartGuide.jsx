import { useT } from '../../i18n/lang.jsx';
import { locFor } from './dashText.jsx';
import '../../i18n/dict/catalog.js';

const PAGE = { orders: 'Orders', products: 'Products', marketing: 'Marketing', settings: 'Settings', deliveries: 'Deliveries', dashboard: 'Dashboard', reviews: 'Reviews', services: 'Servicing', team: 'Team', inbox: 'Inbox', careers: 'Careers', customers: 'Customers' };
const AREA = { orders: 'Sales', products: 'Stock', marketing: 'Marketing', settings: 'Store', deliveries: 'Delivery', dashboard: 'Finance', customers: 'Customers' };
const TONE = { warn: 'Needs attention', tip: 'Idea', good: 'Good news' };

/** The "Smart guide" panel: auto-written insight tiles that jump to the page they talk about. */
export function SmartGuide({ insights, go }) {
  const tr = useT();
  const L = locFor(tr);
  const count = tone => insights.filter(i => i.tone === tone).length;
  const nWarn = count('warn'), nTip = count('tip'), nGood = count('good');
  return (
    <section className="sg">
      <header className="sg-hd">
        <span className="sg-spark">✨</span>
        <div><h3>{tr('Smart guide')}</h3><small>{tr('Written automatically from your orders, stock, customers and payments')}</small></div>
        <div className="sg-sum">
          {nWarn > 0 && <span className="s-warn"><b>{nWarn}</b> {tr('need attention')}</span>}
          {nTip > 0 && <span className="s-tip"><b>{nTip}</b> {nTip === 1 ? tr('idea') : tr('ideas')}</span>}
          {nGood > 0 && <span className="s-good"><b>{nGood}</b> {tr('good news')}</span>}
        </div>
      </header>
      <div className="sg-body">
        {!insights.length && <div className="sg-empty">🎉 {tr('Nothing needs attention right now. New suggestions appear as orders and stock change.')}</div>}
        <div className="sg-grid">
          {insights.map((i, n) => (
            <button type="button" key={n} className={'sg-t sg-' + i.tone} style={{ '--i': n }} onClick={() => go(i.page)} title={L.guide(i.text)}>
              <span className="sg-ic">{i.icon}</span>
              <div className="sg-main">
                <div className="sg-meta"><em>{tr(TONE[i.tone])}</em>{AREA[i.page] && <span>{tr(AREA[i.page])}</span>}</div>
                <b>{L.guide(i.title)}</b>
                <small>{L.guide(i.text)}</small>
                <span className="sg-go">{PAGE[i.page] ? tr('Open {page}', { page: tr(PAGE[i.page]) }) : tr('Open page')} <i>→</i></span>
              </div>
            </button>
          ))}
        </div>
        <p className="sg-note">{tr('How it works: figures come straight from the application\'s own transactions; the forecast is the average of each weekday over the last 8 weeks, adjusted by the recent trend. It is a guide, not a promise.')}</p>
      </div>
    </section>
  );
}
