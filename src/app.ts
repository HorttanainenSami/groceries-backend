import express, { Express } from 'express';
import cors from 'cors';
import { router as authRouter } from './modules/auth/auth.router';
import { handleRestfulError } from './middleware/ErrorHandler';
import requireAuth from './middleware/requireAuth';
import { router as userRouter } from './modules/user/user.router';
import { router as relationRouter } from './modules/relations/relations.router';
import dotenv from 'dotenv';
import path from 'path';

const env_file = `.env.${process.env.NODE_ENV}`;
dotenv.config({ path: path.resolve(__dirname, `../../${env_file}`) });

export const app: Express = express();
app.use(cors());
app.use(express.json());
app.use('', authRouter);
app.use(requireAuth);
app.use('/user', userRouter);
app.use('/relations', relationRouter);
app.use(handleRestfulError);
