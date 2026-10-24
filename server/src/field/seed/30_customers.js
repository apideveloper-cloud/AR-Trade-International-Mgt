// Demo customers, visits and follow-ups from the app design. Runs only while the tables are empty.
import { bdDate, bdToDate, addDays, utcSql } from '../crm_util.js';

// name, contact, role, area, phone, email, kind, owner (staff email prefix), type, next step
const CUSTOMERS = [
  ['Jamuna Bank', 'Kamrul Hasan', 'Admin Officer', 'Dilkusha', '01711-204587', 'kamrul@jamunabank.com.bd', 'Active', 'rm', 'Bank', ''],
  ['BRAC Bank', 'Farzana Rahman', 'Procurement', 'Gulshan-1', '01819-332140', 'farzana.r@bracbank.com', 'Active', 'rm', 'Bank', ''],
  ['Walton Plaza', 'Sohel Rana', 'Accounts', 'Motijheel', '01755-918823', 'sohel@waltonbd.com', 'Active', 'rm', 'Corporate', ''],
  ['Square Pharma', 'Arif Chowdhury', 'IT Manager', 'Mohakhali', '01713-447210', 'arif@squarepharma.com.bd', 'Active', 'rm', 'Corporate', ''],
  ['City Bank', 'Nadia Islam', 'Facility Manager', 'Uttara', '01912-556031', '', 'Active', 'sumaiya.akter', 'Bank', ''],
  ['IDLC Finance', 'Nusrat Jahan', 'Admin Head', 'Gulshan Ave', '01711-552201', '', 'Active', 'rm', 'Corporate', ''],
  ['Prime Bank', 'Shafiq Ahmed', 'IT Head', 'Banani', '01716-880412', '', 'Upcoming', 'sumaiya.akter', 'Bank', 'Visit tomorrow'],
  ['Summit Power', 'Rezaul Karim', 'Procurement', 'Banani', '01833-120975', '', 'Upcoming', 'mahmud.karim', 'Corporate', 'Send quote'],
  ['Dhaka WASA', 'Habibur Rahman', 'Store Keeper', 'Kawran Bazar', '01552-301877', '', 'Upcoming', 'rm', 'Govt.', 'Demo 24 Oct'],
  ['ACI Limited', 'Rezaul Karim', 'Admin Manager', 'Tejgaon I/A', '01711-340021', '', 'Active', 'mahmud.karim', 'Corporate', ''],
  ['Pran-RFL Group', 'Shirin Akter', 'Procurement', 'Badda', '01712-770145', '', 'Active', 'mahmud.karim', 'Corporate', ''],
  ['Bashundhara Group', 'Imran Hossain', 'IT Head', 'Bashundhara R/A', '01713-601188', '', 'Inactive', 'rm', 'Corporate', ''],
  ['Beximco Ltd', 'Asif Mahmud', 'Admin Officer', 'Tejgaon', '01714-229930', '', 'Upcoming', 'sumaiya.akter', 'Corporate', 'Call in 3 days'],
  ['Robi Axiata', 'Tahmina Akhter', 'Procurement', 'Gulshan-1', '01715-334412', '', 'Active', 'sumaiya.akter', 'Corporate', ''],
  ['Eastern Bank', 'Saiful Islam', 'IT Manager', 'Gulshan-2', '01716-908817', '', 'Upcoming', 'mahmud.karim', 'Bank', 'Demo next week'],
  ['Akij Group', 'Mizanur Rahman', 'Store Keeper', 'Tejgaon', '01717-440992', '', 'Inactive', 'rm', 'Corporate', ''],
  ['Dutch-Bangla Bank', 'Rubina Yasmin', 'Admin Head', 'Motijheel', '01718-125560', '', 'Active', 'rm', 'Bank', ''],
  ['Meghna Group', 'Jahidul Alam', 'Procurement', 'Karwan Bazar', '01719-663301', '', 'Upcoming', 'sumaiya.akter', 'Corporate', 'Send quote'],
  ['BSRM', 'Kawsar Ahmed', 'Facility Manager', 'Agrabad', '01720-558844', '', 'Active', 'mahmud.karim', 'Corporate', ''],
  ['Navana Ltd', 'Shahana Parvin', 'Accounts', 'Gulshan-1', '01721-771209', '', 'Upcoming', 'rm', 'Corporate', 'Visit tomorrow']
];

// today's visits of the demo RM (time, client, purpose, state)
const TODAY = [
  ['09:30', 'Jamuna Bank', 'Delivery', 'done', 'Order taken', 48500, 'Needs 20 x HP 85A every month. Asked for an annual contract quote with free pickup of empty cartridges.', '09:34', '10:12', 'Send quote', 'Tomorrow'],
  ['11:00', 'BRAC Bank', 'Sales pitch', 'done', 'Quotation', 0, 'Current AMC ends 30 Nov. Wants pricing for 14 printers incl. 2 color units. Decision by procurement committee.', '11:06', '11:48', 'Call', 'In 3 days'],
  ['12:30', 'Square Pharma', 'Sampling', 'planned'],
  ['14:30', 'Walton Plaza', 'Collection', 'planned'],
  ['16:00', 'Dhaka WASA', 'Demo', 'planned'],
  ['17:15', 'IDLC Finance', 'Follow-up', 'planned']
];

// title, customer, note, action, offset in days, time, owner
const FOLLOWUPS = [
  ['Call back on HP 26A order', 'Bashundhara Group', 'Client asked for revised price on 30 units; promised a call yesterday.', 'Call', -1, '10:00'],
  ['Collect cheque ৳ 32,000', 'City Bank', 'Cheque ready with accounts after 3 PM. Bring money receipt.', 'Collect', 0, '15:30'],
  ['Send Canon 057 quotation', 'Summit Power', 'Needs 12 units with 6-month warranty, delivery within a week.', 'Send quote', 0, '17:00'],
  ['Send annual contract quote', 'Jamuna Bank', '20 x HP 85A monthly, include free empty pickup.', 'Send quote', 1, '11:00'],
  ['Call re: AMC pricing', 'BRAC Bank', 'Share pricing for 14 printers incl. 2 color units.', 'Call', 3, '11:00']
];

export default async function seed({ pool }) {
  const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM field_customers');
  if (n) return;
  const [staff] = await pool.query('SELECT id, email FROM staff');
  const sid = key => staff.find(s => s.email.startsWith(key + '@'))?.id || null;
  const rm = sid('rm');
  if (!rm) return;

  const ids = new Map();
  for (const [name, person, role, area, phone, email, kind, owner, type, next] of CUSTOMERS) {
    const [r] = await pool.query(
      'INSERT INTO field_customers (name, contact_person, contact_role, phone, email, area, address, kind, customer_type, next_step, owner_staff_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [name, person, role, phone, email, area, area + ', Dhaka', kind, type, next, sid(owner) || rm]);
    ids.set(name, r.insertId);
  }

  const today = bdDate();
  const [[{ v }]] = await pool.query('SELECT COUNT(*) v FROM field_visits');
  if (!v) {
    const utc = (d, t) => utcSql(bdToDate(d, t));
    for (const [time, client, purpose, state, outcome, value, notes, inT, outT, fuAction, fuWhen] of TODAY) {
      const done = state === 'done';
      await pool.query(
        `INSERT INTO field_visits (customer_id, staff_id, visit_date, visit_time, purpose, status, check_in, check_out, outcome, order_value, notes, followup_action, followup_when)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [ids.get(client), rm, today, time + ':00', purpose, done ? 'Done' : 'Planned', done ? utc(today, inT) : null, done ? utc(today, outT) : null,
          done ? outcome : '', done ? value : 0, done ? notes : null, done ? fuAction : '', done ? fuWhen : '']);
    }
    // earlier and later days of the week strip, so the counts are not empty
    const spread = { '-1': 4, '-2': 5, '-3': 3, '-4': 6, '1': 2, '2': 3 };
    const names = [...ids.keys()];
    for (const [off, cnt] of Object.entries(spread)) {
      const d = addDays(today, Number(off));
      for (let i = 0; i < cnt; i++) {
        const past = Number(off) < 0;
        await pool.query(
          'INSERT INTO field_visits (customer_id, staff_id, visit_date, visit_time, purpose, status, check_in, check_out, outcome, notes) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [ids.get(names[(i * 3 + Math.abs(Number(off))) % names.length]), rm, d, `${String(9 + i * 2).padStart(2, '0')}:30:00`, ['Delivery', 'Demo', 'Collection', 'Sales pitch'][i % 4],
            past ? 'Done' : 'Planned', past ? utc(d, `${String(9 + i * 2).padStart(2, '0')}:35`) : null, past ? utc(d, `${String(10 + i * 2).padStart(2, '0')}:05`) : null, past ? 'Interested' : '', past ? 'Routine visit.' : null]);
      }
    }
  }

  const [[{ f }]] = await pool.query('SELECT COUNT(*) f FROM field_followups');
  if (!f) {
    for (const [title, client, note, action, off, time] of FOLLOWUPS) {
      await pool.query('INSERT INTO field_followups (customer_id, staff_id, title, note, action, due_at, history_json) VALUES (?,?,?,?,?,?,?)',
        [ids.get(client), rm, title, note, action, utcSql(bdToDate(addDays(today, off), time)), JSON.stringify([])]);
    }
  }
}
