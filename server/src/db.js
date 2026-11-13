import mysql from 'mysql2/promise';
import 'dotenv/config';

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  charset: 'utf8mb4',
  stringifyObjects: true, // a JSON body such as {"a":1} where text was expected must never expand into column = value SQL
  waitForConnections: true,
  connectionLimit: 10
});
