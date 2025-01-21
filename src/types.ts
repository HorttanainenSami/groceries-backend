import { z } from 'zod';
import { loginSchema, userSchema } from './modules/auth/auth.schema';
import { JwtPayload } from 'jsonwebtoken';

export type User = z.infer<typeof userSchema>;
export type NewUser = Omit<
  User,
  'journals' | 'id' | 'count' | 'journalCount' | 'imageCount'
>;
export type IUserLogin = z.infer<typeof loginSchema>;
export interface TokenDecoded extends JwtPayload {
  id: number;
  email: string;
}
