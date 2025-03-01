import { query } from '../../database/connection';
import {AuthenticationError} from '../../middleware/Error.types';
import { userSchema } from '../auth/auth.schema';
import {searchType} from './user.schema';


export const getUsersByParams = async ( params : searchType) => {
  console.log('inGetUsersByParams: ', params);
  const q = await query(
    `SELECT * FROM users WHERE name LIKE '%'|| $1 ||'%' ;`,
    [params.name]
  );
  return userSchema.array().parse(q.rows).map(({name}) => ({name}));
  
};

export const makeFriends = async ( params : string) => {
  console.log('inGetUsersByParams: ', params);
  //TODO ensure that user_id is smaller than friend_id when searhing from database
};
