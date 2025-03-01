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
    await pool.query(createFriendsList);
  } catch (error) {
    console.error(error);
  }
};
const createUsers = `CREATE TABLE IF NOT EXISTS Users (
"id" SERIAL PRIMARY KEY,
"email" VARCHAR NOT NULL UNIQUE,
"password" VARCHAR NOT NULL,
"name" VARCHAR NOT NULL UNIQUE);
`;
const createFriendsList = `CREATE TABLE IF NOT EXISTS FRIENDS(
  "user_id" INT NOT NULL,
  "friend_id" INT NOT NULL,
  PRIMARY KEY (user_id, friend_id),
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (friend_id) REFERENCES Users(id) ON DELETE CASCADE,
  CONSTRAINT not_self CHECK(user_id <> friend_id),
  CONSTRAINT ascending_friend_id CHECK(user_id > friend_id)
  )
`
export const query = async (text: string, params: string[]) =>
  pool.query(text, params);
export const transactionClient = () => pool.connect();
export default { query };
