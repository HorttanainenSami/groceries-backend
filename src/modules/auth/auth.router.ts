import express from 'express';
import { login, register, refreshToken } from './auth.controller';

export const router = express.Router();

router.post('/login', login);
router.post('/signup', register);
router.post('/refresh', refreshToken);
