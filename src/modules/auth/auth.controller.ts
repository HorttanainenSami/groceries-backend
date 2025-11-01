import { NextFunction, Request, Response } from 'express';
import userApi from './auth.service';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { secret } from '../../resources/utils';
import { loginReqBodySchema, LoginResponseType, registerReqBodySchema, RegisterResponseType, UserType  } from '@groceries/shared_types';
import { AuthenticationError } from '../../middleware/Error.types';

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
    const { password, ...user } = await userApi.createUser(
      encryptedPasswordUser
    );
    res.send(user);
  } catch (error) {
    console.log(error);
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response<LoginResponseType>,
  next: NextFunction
) => {
  try {
    console.log(req.body);
    const initialUser = loginReqBodySchema.safeParse(req.body);
    if (initialUser.error)
      return next(new AuthenticationError('Invalid credentials'));
    const user: UserType = await userApi.getUserByEmail(initialUser.data);
    //same error message if email or pass is wrong for security
    if (
      user === null ||
      !(await bcrypt.compare(initialUser.data.password, user.password))
    ) {
      next(new AuthenticationError('Invalid credentials'));
    }
    const { email, id } = user;
    const token = jwt.sign({ email, id }, secret(), { expiresIn: '7d' });
    res.send({ token, email, id });
  } catch (err) {
    next(err);
  }
};
