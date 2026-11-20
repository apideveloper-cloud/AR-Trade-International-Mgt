import { useEffect, useState } from 'react';
import { adm, can } from '../../adminApi.js';
import { useApiData } from '../../hooks/useApiData.js';
import { Msg } from './parts.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/growthD.js';
import BzDetails from './BzDetails.jsx';
import BzNap from './BzNap.jsx';
import BzGbp from './BzGbp.jsx';
import BzDigest from './BzDigest.jsx';
import './growth.css';
import './business.css';

/** Admin > Search & Growth > Business & Google profile. */
export function GrowthBusiness({ staff }) {
  const tr = useT();
  const q = useApiData(() => adm.get('/growth/business'), []);
  const [d, setD] = useState(null);
  useEffect(() => { if (q.data) setD(q.data); }, [q.data]);
  if (q.error && !d) return <div className="adbz"><Msg m={{ ok: false, text: tr(q.error) }} /></div>;
  if (!d) return <div className="adbz"><p className="adbz-hint">{tr('Loading...')}</p></div>;
  const patch = p => setD(x => ({ ...x, ...p }));
  return (
    <div className="adbz">
      <BzDetails info={d.info} canEdit={can(staff, 'settings.manage')} onSaved={info => info && patch({ info })} />
      <BzNap nap={d.nap} onChecked={nap => patch({ nap })} />
      <BzGbp gbp={d.gbp} copy={d.copy} canEdit={can(staff, 'seo.manage')} onSaved={gbp => gbp && patch({ gbp })} />
      <BzDigest />
    </div>
  );
}
