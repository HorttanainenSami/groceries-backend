import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { router as authRouter } from './modules/auth/auth.router';
import { initializeTables } from './database/connection';
import ErrorHandler  from './middleware/ErrorHandler';
import requireAuth  from './middleware/requireAuth';
import {router as user} from './modules/user/user.router';
import 'dotenv/config';

const app: Express = express();
const port = 3003;
initializeTables();
app.use(cors());
app.use(express.json());
app.use('', authRouter);
app.use(requireAuth);
app.use('/user', user);
app.use(ErrorHandler);
app.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}`);
});
