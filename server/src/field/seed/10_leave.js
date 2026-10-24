// Demo data for leave + notifications (from the app design). Local development only.
const id = async (pool, email) => (await pool.query('SELECT id FROM staff WHERE email = ?', [email]))[0][0]?.id;

const NOTES = [
  // icon, title, sub, cat, minutes ago, unread, body, rows, a1, a1Icon, a2
  ['fact_check', 'Expense approved', 'Fuel ৳ 1,200 approved by Accounts', 'Approvals', 2, true,
    "Fuel expense for 21 Oct client visits has been approved and will be added to this month's salary.",
    [['Amount', '৳ 1,200'], ['Voucher', 'EXP-2291 · photo attached'], ['Approved by', 'Nasrin Akter · Accounts'], ['Payout', 'With Oct salary']], 'View voucher', 'receipt_long', 'Close'],
  ['event_available', 'Leave request pending', 'Your casual leave is with Manager', 'Approvals', 18, true,
    'Your casual leave request is waiting for Manager review. You will be notified once it is decided.',
    [['Type', 'Casual leave'], ['Dates', '27–28 Oct · 2 days'], ['Balance after', '6 days left'], ['Reviewer', 'Kamal Hossain · Manager']], 'Track request', 'pending_actions', 'Cancel request'],
  ['warning', 'Outside work zone', 'Farhan left assigned area · 1.4 km', 'Alerts', 34, true,
    'Farhan Rahman moved outside his assigned work zone during duty hours. Check in with him or review the route.',
    [['Field officer', 'Farhan Rahman'], ['Location', 'Khilgaon · 1.4 km out'], ['Detected', '10:12 AM · GPS'], ['Assigned zone', 'Motijheel–Paltan']], 'Call Farhan', 'call', 'View on map'],
  ['local_shipping', 'Delivery confirmed', 'DN-0583 · Jamuna Bank received', 'Updates', 60, false,
    'Delivery DN-0583 was received and signed by the client. Proof of delivery is saved.',
    [['Client', 'Jamuna Bank, Dilkusha'], ['Items', '12 × HP 85A toner'], ['Proof', 'Signature + photo'], ['Delivered by', 'Rafiq Hasan']], 'View proof', 'verified', 'Close'],
  ['inventory_2', 'Low stock alert', 'HP 79A below minimum (8 left)', 'Alerts', 120, false,
    'HP 79A toner stock is below the minimum level. Raise a purchase request to avoid stock-out.',
    [['Product', 'HP 79A (CF279A)'], ['In stock', '8 units'], ['Minimum', '20 units'], ['Avg. weekly sale', '14 units']], 'Create PO', 'add_shopping_cart', 'Later'],
  ['campaign', 'Price update', 'Toshiba toners revised from 1 Nov', 'Updates', 300, false,
    'Toshiba toner prices are revised from 1 November. Updated prices will appear in Sales Order automatically.',
    [['Brand', 'Toshiba'], ['Effective', '1 Nov 2026'], ['Change', '+3–5% on 6 SKUs'], ['Sent by', 'Head office']], 'See price list', 'sell', 'Close']
];

export default async function seed({ pool }) {
  const rafiq = await id(pool, 'rm@artradeinternational.com');
  const kamal = await id(pool, 'kamal.hossain@artradeinternational.com');
  if (!rafiq) return;

  const [[has]] = await pool.query('SELECT COUNT(*) n FROM field_leave_requests WHERE staff_id = ?', [rafiq]);
  if (!has.n) {
    const L = (staff, type, from, to, days, reason, status, remarks = '', by = null) =>
      pool.query('INSERT INTO field_leave_requests (staff_id,type,from_date,to_date,days,reason,status,remarks,decided_by,decided_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [staff, type, from, to, days, reason, status, remarks, by, status === 'Open' ? null : new Date().toISOString().slice(0, 19).replace('T', ' ')]);
    // Rafiq's year so far -> balances Casual 6/10, Sick 8/14, Annual 12/20
    await L(rafiq, 'Casual', '2026-03-10', '2026-03-12', 3, 'Family matter', 'Approved', 'OK', kamal);
    await L(rafiq, 'Casual', '2026-10-08', '2026-10-08', 1, 'Personal work at bank', 'Approved', 'OK', kamal);
    await L(rafiq, 'Sick', '2026-05-04', '2026-05-09', 6, 'Fever, doctor advised rest', 'Approved', 'Get well soon', kamal);
    await L(rafiq, 'Annual', '2026-07-05', '2026-07-14', 8, 'Eid holidays with family', 'Approved', 'Enjoy', kamal);
    // the team's requests shown in the manager's Approvals tab
    const farhan = await id(pool, 'farhan.rahman@artradeinternational.com');
    const tanvir = await id(pool, 'purchase@artradeinternational.com');
    const nusrat = await id(pool, 'nusrat.haque@artradeinternational.com');
    if (farhan) await L(farhan, 'Sick', '2026-10-23', '2026-10-24', 2, 'Fever, doctor advised rest. Prescription attached.', 'Open');
    if (tanvir) await L(tanvir, 'Annual', '2026-11-02', '2026-11-06', 5, 'Visiting family in Sylhet. Handover to Mahmud.', 'Open');
    if (nusrat) await L(nusrat, 'Casual', '2026-10-20', '2026-10-20', 1, 'Personal work at bank.', 'Approved', 'OK, enjoy your leave', kamal);
  }

  // the same six sample notifications for the demo field / RM logins
  for (const email of ['rm@artradeinternational.com', 'field@artradeinternational.com']) {
    const sid = await id(pool, email);
    if (!sid) continue;
    const [[done]] = await pool.query("SELECT COUNT(*) n FROM field_notifications WHERE staff_id = ? AND title = 'Price update'", [sid]);
    if (done.n) continue;
    for (const [icon, title, sub, cat, mins, unread, body, rows, a1, a1Icon, a2] of NOTES.slice().reverse()) {
      await pool.query(
        `INSERT INTO field_notifications (staff_id,icon,title,sub,body,cat,rows_json,a1,a1_icon,a2,created_at,read_at)
         VALUES (?,?,?,?,?,?,?,?,?,?, NOW() - INTERVAL ? MINUTE, ${unread ? 'NULL' : 'NOW()'})`,
        [sid, icon, title, sub, body, cat, JSON.stringify(rows), a1, a1Icon, a2, mins]);
    }
  }
}
