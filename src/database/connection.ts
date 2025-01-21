import pg, { DatabaseError, QueryResult } from 'pg';
import 'dotenv/config';
const { Client, Pool } = pg;
const port = parseInt(process.env.DATABASE_PORT || '', 10) || 5432;
const pool = new Pool({
  host: process.env.DATABASE_HOST,
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  port: port,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (error, client) =>
  console.log('client: ', client, 'error: ', error)
);
export const initializeTables = async () => {
  try {
    console.log('initializing db tables');
    await pool.query(createUsers);
  } catch (error) {
    console.error(error);
  }
};
const createUsers = `CREATE TABLE IF NOT EXISTS Users (
"id" serial primary key,
"email" varchar not null unique,
"password" varchar not null,
"name" varchar);
`;
export const query = async (text: string, params: string[]) =>
  pool.query(text, params);
export const transactionClient = () => pool.connect();
export default { query };
