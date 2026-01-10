import { Request, Response, NextFunction } from 'express';
import { decodeTokenFromRequest } from '../resources/utils';
import { AuthorizationError, NotFoundError, TokenExpiredError } from '../middleware/Error.types';
import { getUserById } from '../modules/user/user.service';

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['authorization'];

  if (!token) {
    return next(new AuthorizationError('Access Token Required'));
  }
  try {
    const decodedToken = decodeTokenFromRequest(req);
    // check if user still exists
    await getUserById(decodedToken.id);
  } catch (err) {
    if (err instanceof Error && err.name === 'JsonWebTokenError') {
      const date = new Date();
      return next(new TokenExpiredError('Error: token expired', date));
    } else if (err instanceof NotFoundError) {
      return next(new AuthorizationError('No authorization'));
    }
    return next(err);
  }
  return next();
}

export default requireAuth;
