import { Request, Response, NextFunction } from 'express';
import { getTokenFrom, secret } from '../resources/utils';
import { AuthorizationError, TokenExpiredError } from '../middleware/Error.types';
import { TokenDecoded } from '../types';
import jwt from 'jsonwebtoken';

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['authorization'];
  console.log('requireAuth');
  if (!token) {
    throw new AuthorizationError('Access Token Required');
  }
  try {
    const token = getTokenFrom(req);
    const decodedToken = jwt.verify(token, secret()) as TokenDecoded;
    const date = new Date();
    console.log('user id', decodedToken.id);
    if (!decodedToken.exp) {
      throw new TokenExpiredError('Error: token expired', date);
    }
    if (decodedToken.exp *1000 < date.getMilliseconds()) {
      throw new TokenExpiredError(
        'Error: token expired',
        new Date(decodedToken.exp*1000)
      );
    }
  } catch (err) {
    return next(err);
  }
  console.log('token is valid');
  console.log('connecting to ', req.url);
  return next();
}
export default requireAuth;
