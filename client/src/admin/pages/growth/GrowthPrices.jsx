import { useState } from 'react';
import { can } from '../../adminApi.js';
import HealthStrip from './HealthStrip.jsx';
import IssueList from './IssueList.jsx';
import PriceGrid from './PriceGrid.jsx';
import CsvCard from './CsvCard.jsx';
import DigestCard from './DigestCard.jsx';
import './growth.css';
import './prices.css';

/** Admin > Search & Growth > Price & stock. */
export function GrowthPrices({ staff }) {
  const canEdit = can(staff, 'products.manage');
  const [filter, setFilter] = useState({ q: '', cat: '', brand: '', issue: '' });
  const [code, setCode] = useState("");
  const [tick, setTick] = useState(0); // bumps after any save so the lists reload
  const refresh = () => setTick(t => t + 1);
  const fix = id => { setFilter(f => ({ ...f, q: String(id), issue: '' })); setTimeout(() => document.getElementById('adgp-grid')?.scrollIntoView({ behavior: 'smooth' }), 50); };
  return (
    <div className="adgp">
      <HealthStrip tick={tick} code={code} setCode={setCode} />
      <IssueList tick={tick} code={code} fix={fix} />
      <PriceGrid canEdit={canEdit} filter={filter} setFilter={setFilter} tick={tick} onSaved={refresh} />
      <CsvCard canEdit={canEdit} onSaved={refresh} />
      <DigestCard />
    </div>
  );
}
