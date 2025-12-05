import pg, { QueryResult } from 'pg';
import path from 'path';
import dotenv from 'dotenv';

const env_file = `.env.${process.env.NODE_ENV}`;
dotenv.config({ path: path.resolve(__dirname, `../../${env_file}`) });

const { Pool } = pg;
const port = parseInt(process.env.DATABASE_PORT ?? '5433');
const poolConfig = {
  host: process.env.DATABASE_HOST,
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  port: port,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};
console.log(poolConfig, env_file);
const pool = new Pool(poolConfig);

pool.on('error', (error, client) => console.log('client: ', client, 'error: ', error));
export const query = async <T extends pg.QueryResultRow>(
  text: string,
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  params: any[]
): Promise<QueryResult<T>> => pool.query<T>(text, params);
export const transactionClient = () => pool.connect();
export default { query };
export { pool };

export function transactionQuery(client: pg.PoolClient): typeof query {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  return async function (text: string, params: any[]) {
    return await client.query(text, params);
  };
}
