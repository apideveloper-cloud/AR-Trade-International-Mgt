// Demo history so the reports are not empty: expense claims (from the app design) and three weeks of attendance.
// Both only run while their table has no older data, so real usage is never mixed with or duplicated by the demo rows.
const EXPENSES = [
  // days ago, hour, title, staff email, amount, category, status, remarks
  [0, 10, 'Fuel · Motijheel route', 'rm@artradeinternational.com', 1200, 'Fuel', 'Approved', 'Approved as per policy'],
  [0, 12, 'Client lunch · Jamuna Bank', 'sumaiya.akter@artradeinternational.com', 1850, 'Food', 'Pending', ''],
  [0, 13, 'CNG · Gulshan visits', 'mahmud.karim@artradeinternational.com', 650, 'Transport', 'Pending', ''],
  [1, 11, 'Courier · toner to Uttara', 'purchase@artradeinternational.com', 420, 'Courier', 'Approved', 'Verified with voucher'],
  [1, 15, 'Fuel · Khilgaon route', 'farhan.rahman@artradeinternational.com', 1500, 'Fuel', 'Rejected', 'Overlaps team schedule'],
  [1, 17, 'Mobile top-up', 'rm@artradeinternational.com', 500, 'Mobile', 'Approved', 'Approved as per policy'],
  [2, 10, 'Uber · BRAC Bank', 'sumaiya.akter@artradeinternational.com', 780, 'Transport', 'Approved', 'Approved as per policy'],
  [2, 16, 'Team snacks · office', 'purchase@artradeinternational.com', 960, 'Food', 'Approved', 'Approved as per policy'],
  [3, 11, 'Fuel · Paltan route', 'mahmud.karim@artradeinternational.com', 1300, 'Fuel', 'Approved', 'Approved as per policy'],
  [5, 12, 'CNG · Dhanmondi visit', 'rm@artradeinternational.com', 540, 'Transport', 'Approved', 'Approved as per policy'],
  [6, 14, 'Courier · printer parts', 'purchase@artradeinternational.com', 380, 'Courier', 'Approved', 'Approved as per policy'],
  [8, 13, 'Fuel · Mirpur route', 'farhan.rahman@artradeinternational.com', 1400, 'Fuel', 'Approved', 'Approved as per policy'],
  [9, 12, 'Client tea & snacks', 'sumaiya.akter@artradeinternational.com', 620, 'Food', 'Approved', 'Approved as per policy'],
  [11, 10, 'Mobile bundle', 'mahmud.karim@artradeinternational.com', 599, 'Mobile', 'Approved', 'Approved as per policy'],
  [12, 15, 'Uber · IDLC Finance', 'rm@artradeinternational.com', 710, 'Transport', 'Rejected', 'Please resubmit with details'],
  [14, 11, 'Fuel · Uttara route', 'mahmud.karim@artradeinternational.com', 1250, 'Fuel', 'Approved', 'Approved as per policy']
];
const CREW = ['rm@artradeinternational.com', 'sumaiya.akter@artradeinternational.com', 'mahmud.karim@artradeinternational.com', 'farhan.rahman@artradeinternational.com', 'purchase@artradeinternational.com', 'field@artradeinternational.com'];

export default async function seed({ pool }) {
  const idOf = async email => (await pool.query('SELECT id FROM staff WHERE email = ?', [email]))[0][0]?.id;

  // ---- expense claims ----
  const [[ex]] = await pool.query('SELECT COUNT(*) n FROM field_expenses WHERE title = ?', [EXPENSES[0][2]]);
  if (!ex.n) {
    const manager = await idOf('manager@artradeinternational.com');
    for (const [ago, hour, title, email, amount, category, status, remarks] of EXPENSES) {
      const staff = await idOf(email);
      if (!staff) continue;
      await pool.query(
        'INSERT INTO field_expenses (staff_id, title, category, amount, status, decided_by, decided_at, remarks, created_at) VALUES (?,?,?,?,?,?,?,?, DATE_SUB(DATE_SUB(NOW(), INTERVAL ? DAY), INTERVAL ? HOUR))',
        [staff, title, category, amount, status, status === 'Pending' ? null : manager, status === 'Pending' ? null : new Date(), remarks, ago, Math.max(0, new Date().getHours() - hour)]);
    }
  }

  // ---- attendance history (BD workdays, Friday off) ----
  const BD = 6 * 3600e3;
  const bdToday = new Date(Date.now() + BD);
  const todayStartUtc = new Date(Date.UTC(bdToday.getUTCFullYear(), bdToday.getUTCMonth(), bdToday.getUTCDate()) - BD);
  const rows = [];
  for (const email of CREW) {
    const id = await idOf(email);
    if (!id) continue;
    // days that already have clock rows (real use or earlier tests) are left alone
    const [have] = await pool.query("SELECT DISTINCT DATE_FORMAT(DATE_ADD(at, INTERVAL 6 HOUR), '%Y-%m-%d') d FROM field_attendance WHERE staff_id = ?", [id]);
    const taken = new Set(have.map(r => r.d));
    for (let back = 1; back <= 21; back++) {
      const dayStart = new Date(todayStartUtc.getTime() - back * 864e5); // BD midnight of that day, as a UTC instant
      const dow = new Date(dayStart.getTime() + BD).getUTCDay();
      if (dow === 5) continue; // Friday
      if (taken.has(new Date(dayStart.getTime() + BD).toISOString().slice(0, 10))) continue;
      const h = (id * 31 + back * 17) % 100;
      if (h < 6) continue; // an absent day now and then
      const inMin = 8 * 60 + 48 + (h % 36) - (h < 20 ? 0 : 6); // ~08:42 .. 09:24 (some late)
      const outMin = 17 * 60 + 50 + ((h * 7) % 50);
      const at = m => new Date(dayStart.getTime() + m * 60000).toISOString().slice(0, 19).replace('T', ' ');
      rows.push([id, 'Clocked In', at(inMin)], [id, 'Clocked Out', at(outMin)]);
    }
  }
  if (rows.length) await pool.query('INSERT INTO field_attendance (staff_id, type, at) VALUES ?', [rows]);
}
