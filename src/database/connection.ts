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
    await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await pool.query(createUsers);
    await pool.query(createFriendsList);
    await pool.query(createTaskRelationsList);
    await pool.query(createTaskList);
    await pool.query(TaskRelationPermissions);
  } catch (error) {
    console.error(error);
  }
};
const createUsers = `
  CREATE TABLE IF NOT EXISTS Users (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4() ,
    "email" VARCHAR NOT NULL UNIQUE,
    "password" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL UNIQUE);
`;
const createFriendsList = `
  CREATE TABLE IF NOT EXISTS FRIENDS(
    "user_id" UUID NOT NULL,
    "friend_id" UUID NOT NULL,
    PRIMARY KEY (user_id, friend_id),
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES Users(id) ON DELETE CASCADE,
    CONSTRAINT not_self CHECK(user_id <> friend_id),
    CONSTRAINT ascending_friend_id CHECK(user_id > friend_id)
  )
`
const createTaskRelationsList = `
  CREATE TABLE IF NOT EXISTS Task_relation(
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4() ,
    "name" VARCHAR NOT NULL,
    "created_at" TEXT NOT NULL
    );
`
const createTaskList = `
  CREATE TABLE IF NOT EXISTS TASK(
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "task" VARCHAR NOT NULL,
    "created_at" TEXT NOT NULL,
    "completed_at" TEXT,
    "completed_by" UUID,
    "task_relations_id" UUID,
    FOREIGN KEY (task_relations_id) REFERENCES Task_relation(id),
    FOREIGN KEY (completed_by) REFERENCES Users(id)
    );
`
const TaskRelationPermissions = `
  CREATE TABLE IF NOT EXISTS task_permissions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      task_relation_id UUID NOT NULL REFERENCES task_relation(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permission VARCHAR(10) NOT NULL CHECK (permission IN ('owner', 'edit')),
      UNIQUE(task_relation_id, user_id)
  );

`

export const query = async <T extends pg.QueryResultRow>(text: string, params: any[]): Promise<QueryResult<T>> =>
  pool.query<T>(text, params);
export const transactionClient = () => pool.connect();
export default { query };
