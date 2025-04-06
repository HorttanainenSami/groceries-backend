import { User, IUserLogin } from '../../types';
import {AuthenticationError} from '../../middleware/Error.types';
import { userSchema, newUserType } from './auth.schema';
import { query } from '../../database/connection';
import bcrypt from 'bcrypt';
import { DatabaseError as pgError } from 'pg';
import { DatabaseError } from '../../middleware/Error.types';

const createUser = async (user: newUserType): Promise<User> => {
  try{

    console.log('createUser', user);
    const q = await query(
      'INSERT INTO users (email, password, name ) values ($1, $2, $3) RETURNING *;',
      [user.email, user.password, user.name]
    );
    if (q.rowCount === 0) {
      throw new Error('user already exists');
    }
    return userSchema.parse(q.rows[0]);
  } catch (error) {
    if (error instanceof pgError) {
      console.error('Error creating user:', error);
    }
    throw error;
  }
};
const getUserByEmail = async (user: IUserLogin): Promise<User> => {
  const loginError = () => {
    throw new AuthenticationError('Email and/or password is wrong!');
  };
  try{
    const q = await query('Select * from  users WHERE email=$1;', [user.email]);
    if (q.rowCount === 0) loginError();
    const password = q.rows[0].password;
    const match = await bcrypt.compare(user.password, password);
    if (!match) loginError();
    return userSchema.parse(q.rows[0]);
  } catch (error) {
    if (error instanceof pgError) {
      console.error('Error fetching user:', error);
      throw new DatabaseError('Failed to fetch user', error);
    }
    throw error;
  }
};

export default {
  createUser,
  getUserByEmail,
};
