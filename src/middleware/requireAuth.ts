import { Request, Response, NextFunction } from 'express';
import { decodeTokenFromRequest } from '../resources/utils';
import { AuthorizationError, TokenExpiredError } from '../middleware/Error.types';

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['authorization'];

  if (!token) {
    return next(new AuthorizationError('Access Token Required'));
  }
  try {
    const _decodedToken = decodeTokenFromRequest(req);
  } catch (err) {
    if (err instanceof Error && err.name === 'JsonWebTokenError') {
      const date = new Date();
      return next(new TokenExpiredError('Error: token expired', date));
    }
    return next(err);
  }
  return next();
}

export default requireAuth;
