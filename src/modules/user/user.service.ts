import { query } from '../../database/connection';
import { DatabaseError as pgError } from 'pg';
import { DatabaseError } from '../../middleware/Error.types';
import { UserType, searchQueryType } from '@groceries/shared_types';

export const getUsersByParams = async (params: searchQueryType) => {
  try {
    console.log('inGetUsersByParams: ', params);
    const q = await query(`SELECT id, name FROM users WHERE name LIKE '%'|| $1 ||'%' ;`, [
      params.name,
    ]);
    return q.rows;
  } catch (error) {
    if (error instanceof pgError) {
      console.error('Error fetching users:', error);
      throw new DatabaseError('Failed to fetch users', error);
    }
    throw error;
  }
};

export const getUserById = async (id: string, txQuery?: typeof query) => {
  if (txQuery === undefined) {
    txQuery = query;
  }
  try {
    const q = await query<Omit<UserType, 'password'>>(
      `SELECT id, name, email FROM users WHERE id = $1;`,
      [id]
    );
    if (q.rows.length === 0) {
      throw new Error('User not found');
    }
    return q.rows[0];
  } catch (error) {
    if (error instanceof pgError) {
      console.error('Error fetching user by ID:', error);
      throw new DatabaseError('Failed to fetch user by ID', error);
    }
    throw error;
  }
};
