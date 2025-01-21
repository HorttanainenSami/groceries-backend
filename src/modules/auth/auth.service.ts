import { User, NewUser, IUserLogin } from '../../types';
import {AuthenticationError} from '../../middleware/Error.types';
import { userSchema } from './auth.schema';
import { query } from '../../database/connection';
import bcrypt from 'bcrypt';

const createUser = async (user: NewUser): Promise<User> => {
  const q = await query(
    'INSERT INTO users (email, password ) values ($1, $2) RETURNING *;',
    [user.email, user.password]
  );
  if (q.rowCount === 0) {
    throw new Error('Something went wrong');
  }
  return userSchema.parse(q.rows[0]);
};
const getUserByEmail = async (user: IUserLogin): Promise<User> => {
  const loginError = () => {
    throw new AuthenticationError('Email and/or password is wrong!');
  };
  const q = await query('Select * from  users WHERE email=$1;', [user.email]);
  if (q.rowCount === 0) loginError();
  const password = q.rows[0].password;
  const match = await bcrypt.compare(user.password, password);
  if (!match) loginError();
  return userSchema.parse(q.rows[0]);
};

export default {
  createUser,
  getUserByEmail,
};
