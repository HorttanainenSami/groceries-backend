import pg, { QueryResult } from 'pg';
import 'dotenv/config';
const { Pool } = pg;
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

export const query = async <T extends pg.QueryResultRow>(text: string, params: any[]): Promise<QueryResult<T>> =>
  pool.query<T>(text, params);
export const transactionClient = () => pool.connect();
export default { query };
