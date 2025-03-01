import { Request, Response, NextFunction } from 'express';
import { decodeToken, getTokenFrom, secret } from '../resources/utils';
import { TokenDecoded } from '../types';
import jwt, { TokenExpiredError } from 'jsonwebtoken';

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['authorization'];
  console.log('requireAuth');
  if (!token) {
    return res.status(403).send('Access Token Required');
  }
  try {
    const token = getTokenFrom(req);
    const decodedToken = jwt.verify(token, secret()) as TokenDecoded;
    const date = new Date();
    console.log('user id', decodedToken.id);
    if (!decodedToken.exp) {
      throw new TokenExpiredError('Error: token expired', date);
    }
    if (decodedToken.exp < date.getMilliseconds()) {
      throw new TokenExpiredError(
        'Error: token expired',
        new Date(decodedToken.exp)
      );
    }
  } catch (err) {
    return next(err);
  }
  console.log('token is valid');
  return next();
}
export default requireAuth;
