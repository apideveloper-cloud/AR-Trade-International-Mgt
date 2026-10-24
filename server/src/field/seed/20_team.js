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
  const bd = new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);
  const dayStartUtc = new Date(`${bd}T00:00:00+06:00`);
  const fmt = d => d.toISOString().slice(0, 19).replace('T', ' ');
  for (const [email, [hour, pts]] of Object.entries(LIVE)) {
    const [[s]] = await pool.query('SELECT id FROM staff WHERE email = ? AND status = "Active"', [email]);
    if (!s) continue;
    const [[has]] = await pool.query('SELECT COUNT(*) n FROM field_attendance WHERE staff_id = ? AND at >= ?', [s.id, fmt(dayStartUtc)]);
    if (has.n) continue;
    const first = pts[0];
    // 09:0x Bangladesh time, or 30 minutes ago if that is still in the future (so the map has someone on it at any hour)
    const clockIn = new Date(Math.min(dayStartUtc.getTime() + (hour * 60 + (s.id % 9)) * 60e3, Date.now() - 30 * 60e3));
    await pool.query('INSERT INTO field_attendance (staff_id, type, at, lat, lng) VALUES (?,?,?,?,?)', [s.id, 'Clocked In', fmt(clockIn), first[0], first[1]]);
    const rows = pts.map(([lat, lng], i) => [s.id, lat, lng, fmt(new Date(Date.now() - (pts.length - 1 - i) * 3 * 60e3))]);
    await pool.query('INSERT INTO field_track (staff_id, lat, lng, at) VALUES ?', [rows]);
  }
}
