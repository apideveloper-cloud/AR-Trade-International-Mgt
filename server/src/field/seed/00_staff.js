// Demo team for the field app (the people in the app design). Local development only; never runs in production.
// Logins: rm@ / rm123456 · purchase@ / purchase123 · everyone else: demo1234  (all @artradeinternational.com)
const TEAM = [
  // name, email, phone, password, role, employee code
  ['Rafiq Hasan', 'rm@artradeinternational.com', '01700000013', 'rm123456', 'RM', 'ART-0247'],
  ['Tanvir Islam', 'purchase@artradeinternational.com', '01700000014', 'purchase123', 'Purchase Officer', 'ART-0251'],
  ['Kamal Hossain', 'kamal.hossain@artradeinternational.com', '01711600452', 'demo1234', 'Manager', 'ART-0101'],
  ['Sumaiya Akter', 'sumaiya.akter@artradeinternational.com', '01712385560', 'demo1234', 'RM', 'ART-0212'],
  ['Mahmud Karim', 'mahmud.karim@artradeinternational.com', '01819773310', 'demo1234', 'RM', 'ART-0233'],
  ['Farhan Rahman', 'farhan.rahman@artradeinternational.com', '01716552093', 'demo1234', 'Field Officer', 'ART-0262'],
  ['Nusrat Haque', 'nusrat.haque@artradeinternational.com', '01912440276', 'demo1234', 'Accountant', 'ART-0150']
];

export default async function seed({ pool, bcrypt }) {
  for (const [name, email, phone, pass, role, code] of TEAM) {
    const [[ex]] = await pool.query('SELECT id FROM staff WHERE email = ? OR phone = ? OR employee_code = ?', [email, phone, code]);
    if (ex) continue;
    await pool.query('INSERT INTO staff (name,email,phone,password_hash,role,status,employee_code) VALUES (?,?,?,?,?,"Active",?)',
      [name, email, phone, await bcrypt.hash(pass, 10), role, code]);
  }
}
