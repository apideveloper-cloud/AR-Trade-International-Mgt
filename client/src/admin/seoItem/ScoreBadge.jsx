import { useT } from '../i18n/lang.jsx';
import '../i18n/dict/catalog.js';

const tone = s => (s >= 80 ? 'ok' : s >= 50 ? 'warn' : 'bad');
const lvl = l => (l === 'pass' || l === 'ok' ? 'ok' : l === 'warn' || l === 'warning' ? 'warn' : 'bad');
const MARK = { ok: '✓', warn: '!', bad: '✕' };

/** SEO score 0-100 with the checklist of what passed and what to fix. */
export function ScoreBadge({ score }) {
  const tr = useT();
  if (!score) return null;
  const s = Math.round(score.score || 0);
  return (
    <div className="adsi-score">
      <div className={'adsi-badge ' + tone(s)} title={tr('SEO score')}><b>{s}</b><small>/100</small></div>
      <ul className="adsi-issues">
        {(score.issues || []).map(i => (
          <li key={i.id}><span className={'adsi-mark ' + lvl(i.level)}>{MARK[lvl(i.level)]}</span><span>{tr(i.message)}{i.fix && lvl(i.level) !== 'ok' && <small>{tr(i.fix)}</small>}</span></li>
        ))}
        {!(score.issues || []).length && <li className="adsi-muted">{tr('No checks to show yet.')}</li>}
      </ul>
    </div>
  );
}
