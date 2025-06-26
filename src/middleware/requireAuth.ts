import { Request, Response, NextFunction } from 'express';
import { decodeTokenFromRequest } from '../resources/utils';
import {
  AuthorizationError,
  TokenExpiredError,
} from '../middleware/Error.types';

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['authorization'];
  console.log('requireAuth');

  if (!token) {
    return next(new AuthorizationError('Access Token Required'));
  }
  try {
    const decodedToken = decodeTokenFromRequest(req);
    console.log('user id', decodedToken.id);
  } catch (err) {
    if (err instanceof Error && err.name === 'JsonWebTokenError') {
      const date = new Date();
      return next(new TokenExpiredError('Error: token expired', date));
    }
    return next(err);
  }
  console.log('token is valid');
  console.log('connecting to ', req.url);
  return next();
}

export default requireAuth;
