// Storefront chat: the form that opens a chat and the assistant's answers.
import { pool } from '../db.js';
import { wrap } from '../util.js';
import { chatReply } from '../chatbot.js';
import { leadByToken, noteLeadMessage, startLead } from '../chatLeads.js';
import { limit } from '../middleware/security.js';
import { loadCatalogue } from './shared.js';

// the assistant answers from the live catalogue; the data is cached for a minute so a busy chat does not hit the database each time
const CHAT_DATA_TTL_MS = 60000;
let chatData = { at: 0, v: null };
async function loadChatData() {
  if (chatData.v && Date.now() - chatData.at < CHAT_DATA_TTL_MS) return chatData.v;
  chatData = { at: Date.now(), v: await loadCatalogue({ full: false }) };
  return chatData.v;
}

export function mountChatRoutes(app) {
  // the form that opens a chat: name, mobile, gender and location are saved as an upcoming-customer record for sellers and marketing
  app.post('/api/chat/start', limit('chatstart', 12, 3600000), wrap(async (req, res) => {
    const lead = await startLead(req.body, req);
    res.json({ ok: true, lead });
  }));

  app.post('/api/chat', limit('chat', 40, 600000), wrap(async (req, res) => {
    const text = String(req.body.text || '').trim().slice(0, 1000);
    if (!text) return res.json({ ok: true });
    const lead = await leadByToken(req.body.lead);
    // the visitor's words always reach the admin inbox (with their name and mobile once they filled the form), whether or not the assistant could answer
    await pool.query('INSERT INTO messages (name,contact,subject,body) VALUES (?,?,?,?)', [lead?.name || 'Live chat visitor', lead?.phone || '', 'Live chat', text]);
    try {
      const reply = await chatReply(req.body, await loadChatData());
      if (lead) await noteLeadMessage(lead.id, text, reply.ctx?.cat).catch(() => {});
      res.json({ ok: true, reply });
    } catch (e) {
      console.error('chat reply failed:', e.message);
      if (lead) await noteLeadMessage(lead.id, text, '').catch(() => {});
      res.json({ ok: true });
    }
  }));
}
