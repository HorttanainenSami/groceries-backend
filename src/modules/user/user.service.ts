import { query } from '../../database/connection';
import { searchType } from './user.schema';
import { DatabaseError as pgError } from 'pg';
import { DatabaseError } from '../../middleware/Error.types';

export const getUsersByParams = async (params: searchType) => {
  try {
    console.log('inGetUsersByParams: ', params);
    const q = await query(
      `SELECT id, name FROM users WHERE name LIKE '%'|| $1 ||'%' ;`,
      [params.name]
    );
    return q.rows;
  } catch (error) {
    if (error instanceof pgError) {
      console.error('Error fetching users:', error);
      throw new DatabaseError('Failed to fetch users', error);
    }
    throw error;
  }
};
