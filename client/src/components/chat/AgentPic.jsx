// the support agent's photo (client/public/agent.webp); the round AR logo is the fallback
const AGENT_PIC = '/agent.webp', LOGO_PIC = '/ar-icon-round.png';

/** The support agent's round photo used in the launcher, the header and beside each agent bubble. */
export default function AgentPic({ className = '' }) {
  return <img className={className} src={AGENT_PIC} alt="Support Team" decoding="async" onError={e => { if (!e.currentTarget.src.endsWith(LOGO_PIC)) e.currentTarget.src = LOGO_PIC; }} />;
}
