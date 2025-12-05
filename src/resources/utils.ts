import jwt, { JsonWebTokenError } from 'jsonwebtoken';
import { Request } from 'express';
import { TokenDecoded } from '@groceries/shared_types';

export const secret = () => {
  const env = process.env.SECRET;
  if (env === undefined || env === null) {
    throw new Error('initialize SECRET to .env');
  }
  return env;
};
export const getTokenFrom = (req: Request) => {
  try {
    const authorization = req.headers.authorization;
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new JsonWebTokenError('Token required');
    }
    return authorization.replace('Bearer ', '');
  } catch {
    throw new JsonWebTokenError('Token required');
  }
};
export function decodeTokenFromRequest(request: Request) {
  const token = getTokenFrom(request);
  const userInfo = decodeToken<TokenDecoded>(token);
  return userInfo;
}

export function decodeToken<T>(token: string) {
  try {
    const decoded = jwt.verify(token, secret()) as T;
    return decoded as T;
  } catch {
    throw new JsonWebTokenError('Invalid/malformed token');
  }
}
