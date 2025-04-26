import { z } from 'zod';
import { loginReqBodySchema, userSchema } from './modules/auth/auth.schema';
import { JwtPayload } from 'jsonwebtoken';

export type User = z.infer<typeof userSchema>;
export type IUserLogin = z.infer<typeof loginReqBodySchema>;
export interface TokenDecoded extends JwtPayload {
  id: string;
  email: string;
}
