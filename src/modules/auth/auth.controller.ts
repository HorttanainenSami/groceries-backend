import { NextFunction, Request, Response } from 'express';
import userApi from './auth.service';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { secret } from '../../resources/utils';
import {
  loginReqBodySchema,
  LoginResponseType,
  registerReqBodySchema,
  RegisterResponseType,
  UserType,
  LoginRequestBodyType,
} from '@groceries/shared_types';
import { AuthenticationError, ForbiddenError } from '../../middleware/Error.types';

export const register = async (
  req: Request,
  res: Response<RegisterResponseType>,
  next: NextFunction
) => {
  try {
    const initialUser = registerReqBodySchema.parse(req.body);
    const encryptedPasswordUser = {
      ...initialUser,
      password: await bcrypt.hash(initialUser.password, 10),
    };
    const { password: _password, ...user } = await userApi.createUser(encryptedPasswordUser);
    res.send(user);
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response<LoginResponseType>, next: NextFunction) => {
  try {
    const initialUser = loginReqBodySchema.safeParse(req.body);
    if (initialUser.error) return next(new AuthenticationError('Invalid credentials'));
    res.send(await loginHandler(initialUser.data));
  } catch (err) {
    next(err);
  }
};
export const loginHandler = async (initialUser: LoginRequestBodyType) => {
  const user: UserType = await userApi.getUserByEmail(initialUser);
  //same error message if email or pass is wrong for security
  if (user === null || !(await bcrypt.compare(initialUser.password, user.password))) {
    throw new AuthenticationError('Invalid credentials');
  } else {
    const { email, id } = user;
    const refreshToken = jwt.sign({ email, id }, secret(), {
      expiresIn: '30d',
      jwtid: randomUUID(),
    });
    const accessToken = jwt.sign({ email, id }, secret(), { expiresIn: '1h' });
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await userApi.saveRefreshToken(refreshToken, id, expiresAt);
    return { refreshToken, accessToken, email, id };
  }
};

export const refreshToken = async (
  req: Request,
  res: Response<LoginResponseType>,
  next: NextFunction
) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new AuthenticationError('No refresh token provided');

    const decoded = jwt.verify(refreshToken, secret()) as { email: string; id: string };
    const isValid = await userApi.isRefreshTokenValid(refreshToken);
    if (!isValid) throw new ForbiddenError('Invalid or expired refresh token');

    const newRefreshToken = jwt.sign({ email: decoded.email, id: decoded.id }, secret(), {
      expiresIn: '30d',
      jwtid: randomUUID(),
    });
    const newAccessToken = jwt.sign({ email: decoded.email, id: decoded.id }, secret(), {
      expiresIn: '1h',
    });
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await userApi.revokeRefreshToken(refreshToken);
    await userApi.saveRefreshToken(newRefreshToken, decoded.id, expiresAt);

    res.send({
      refreshToken: newRefreshToken,
      accessToken: newAccessToken,
      email: decoded.email,
      id: decoded.id,
    });
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError || err instanceof jwt.JsonWebTokenError) {
      return next(new ForbiddenError('Invalid or expired refresh token'));
    }
    next(err);
  }
};
