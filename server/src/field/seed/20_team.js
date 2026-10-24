// Demo data for the team map: two vendors, and (local dev only) a few clocked-in staff with GPS points so the manager's live map
// is not empty. Idempotent: staff that already have attendance today are left alone.
const VENDORS = [
  ['Global Toner BD', 'Vendor · Toner supplier', '01711-908812', 'sales@globaltonerbd.com', 'Elephant Rd, Dhaka'],
  ['Techno Supplies', 'Vendor · Printer parts', '01915-270044', 'info@technosupplies.com.bd', 'Nawabpur, Dhaka']
];

// email -> [clock-in hour (Bangladesh time), path of [lat, lng] points, newest last]
const LIVE = {
  'rm@artradeinternational.com': [9, [[23.7330, 90.4172], [23.7365, 90.4150], [23.7403, 90.4106]]], // Kakrail
  'sumaiya.akter@artradeinternational.com': [9, [[23.7300, 90.4150], [23.7322, 90.4168], [23.7330, 90.4172]]], // Motijheel
  'mahmud.karim@artradeinternational.com': [9, [[23.7340, 90.4100], [23.7360, 90.4125], [23.7385, 90.4137]]], // Paltan
  'farhan.rahman@artradeinternational.com': [9, [[23.7200, 90.4700], [23.7000, 90.5000], [23.6850, 90.5200]]], // far out east: off route
  'purchase@artradeinternational.com': [9, [[23.7465, 90.4124]]] // Santinagar office
};

export default async function seed({ pool }) {
  for (const [name, kind, phone, email, address] of VENDORS) {
    await pool.query('INSERT IGNORE INTO field_vendors (name, kind, phone, email, address) VALUES (?,?,?,?,?)', [name, kind, phone, email, address]);
  }
  const H = 3600e3, DAY = 864e5, BD = 6 * H;
  const bd = new Date(Date.now() + BD).toISOString().slice(0, 10);
  const dayStartUtc = new Date(`${bd}T00:00:00+06:00`);
  const fmt = d => d.toISOString().slice(0, 19).replace('T', ' ');
  const bdNowMs = Date.now() + BD - Date.parse(bd + 'T00:00:00Z'); // ms since Bangladesh midnight
  const working = bdNowMs >= 8.5 * H; // before 08:30 nobody is on duty yet, so no one is shown clocked in

  for (const [email, [hour, pts]] of Object.entries(LIVE)) {
    const [[s]] = await pool.query('SELECT id FROM staff WHERE email = ? AND status = "Active"', [email]);
    if (!s) continue;
    const [[has]] = await pool.query('SELECT COUNT(*) n FROM field_attendance WHERE staff_id = ? AND at >= ?', [s.id, fmt(dayStartUtc)]);
    const first = pts[0];
    const inAt = new Date(dayStartUtc.getTime() + (hour * 60 + (s.id % 9)) * 60e3); // 09:0x Bangladesh time
    if (has.n) {
      // repair rows an earlier version of this seed wrote at night ("30 minutes ago" at 03:24): move that clock-in to 09:0x
      if (working && bdNowMs >= 9.5 * H) {
        await pool.query(
          `UPDATE field_attendance SET at = ? WHERE staff_id = ? AND type = 'Clocked In' AND at >= ? AND at < ? AND lat = ? AND lng = ?
             AND (SELECT n FROM (SELECT COUNT(*) n FROM field_attendance WHERE staff_id = ? AND at >= ?) c) = 1`,
          [fmt(inAt), s.id, fmt(dayStartUtc), fmt(new Date(dayStartUtc.getTime() + 8 * H)), first[0], first[1], s.id, fmt(dayStartUtc)]);
      }
      continue;
    }
    if (!working) continue;
    const clockIn = new Date(Math.min(inAt.getTime(), Date.now() - 30 * 60e3));
    await pool.query('INSERT INTO field_attendance (staff_id, type, at, lat, lng) VALUES (?,?,?,?,?)', [s.id, 'Clocked In', fmt(clockIn), first[0], first[1]]);
    const rows = pts.map(([lat, lng], i) => [s.id, lat, lng, fmt(new Date(Date.now() - (pts.length - 1 - i) * 3 * 60e3))]);
    await pool.query('INSERT INTO field_track (staff_id, lat, lng, at) VALUES ?', [rows]);
  }

  // forgotten clock-outs: a session still open from a previous day would make the server answer "You are already clocked in" at the
  // next clock-in (and shows a huge duty time). Close those at 9 hours after the clock-in, never later than the end of that day.
  const [open] = await pool.query(`SELECT a.staff_id, DATE_FORMAT(a.at,'%Y-%m-%d %H:%i:%s') at FROM field_attendance a
    WHERE a.type = 'Clocked In' AND a.at < ? AND a.id = (SELECT b.id FROM field_attendance b WHERE b.staff_id = a.staff_id ORDER BY b.at DESC, b.id DESC LIMIT 1)`, [fmt(dayStartUtc)]);
  for (const o of open) {
    const inMs = Date.parse(o.at.replace(' ', 'T') + 'Z');
    const endOfThatDay = Date.parse(new Date(inMs + BD).toISOString().slice(0, 10) + 'T00:00:00Z') - BD + DAY - 60e3;
    await pool.query('INSERT INTO field_attendance (staff_id, type, at) VALUES (?,?,?)', [o.staff_id, 'Clocked Out', fmt(new Date(Math.min(inMs + 9 * H, endOfThatDay)))]);
  }

  // the days before today (Friday = weekly off, approved leave skipped): clock in ~09:00, out ~18:00, one late day, one long day,
  // so the Home "This week" card has something sensible to show. Only days that have no attendance at all are filled.
  const HISTORY = ['rm@artradeinternational.com', 'field@artradeinternational.com', 'sumaiya.akter@artradeinternational.com',
    'mahmud.karim@artradeinternational.com', 'farhan.rahman@artradeinternational.com', 'purchase@artradeinternational.com'];
  for (const email of HISTORY) {
    const [[st]] = await pool.query('SELECT id FROM staff WHERE email = ? AND status = "Active"', [email]);
    if (!st) continue;
    for (let back = 1; back <= 10; back++) {
      const day = new Date(Date.parse(bd + 'T00:00:00Z') - back * DAY);
      const date = day.toISOString().slice(0, 10);
      if (day.getUTCDay() === 5) continue;
      const start = new Date(`${date}T00:00:00+06:00`);
      const [[hasDay]] = await pool.query('SELECT COUNT(*) n FROM field_attendance WHERE staff_id = ? AND at >= ? AND at < ?', [st.id, fmt(start), fmt(new Date(start.getTime() + DAY))]);
      if (hasDay.n) continue;
      const [[lv]] = await pool.query("SELECT COUNT(*) n FROM field_leave_requests WHERE staff_id = ? AND status = 'Approved' AND from_date <= ? AND to_date >= ?", [st.id, date, date]).catch(() => [[{ n: 0 }]]);
      if (lv.n) continue;
      const k = (st.id + back) % 7;
      const inMin = k === 3 ? 9 * 60 + 38 : 8 * 60 + 50 + ((st.id * 7 + back * 3) % 22); // one late day, otherwise 08:50-09:11
      const outMin = k === 5 ? 19 * 60 + 12 : 17 * 60 + 55 + ((st.id + back * 5) % 20);
      const at = m => fmt(new Date(start.getTime() + m * 60e3));
      await pool.query('INSERT INTO field_attendance (staff_id, type, at, lat, lng) VALUES (?,?,?,?,?),(?,?,?,?,?)',
        [st.id, 'Clocked In', at(inMin), 23.7465, 90.4124, st.id, 'Clocked Out', at(outMin), 23.7465, 90.4124]);
    }
  }
}
