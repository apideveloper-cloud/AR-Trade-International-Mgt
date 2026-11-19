import { useStore } from '../../store.jsx';
import './info.css';

/** FAQ page: one collapsible <details> per question. */
export function Faq() {
  const { content, tk } = useStore();
  return (
    <section className="inf-faq">
      <div className="inf-faq-hd"><h1 className="inf-faq-h1">Frequently asked questions</h1><span className="inf-faq-sub">Ordering, delivery, payment and warranty.</span></div>
      <div className="inf-faq-list">
        {content.faqs.map(f => <details className="faq" key={f.q}><summary>{tk(f.q)}</summary><p>{tk(f.a)}</p></details>)}
      </div>
    </section>
  );
}
