import express from 'express';
import { getUsersBySearchParams } from './user.controller';

export const router = express.Router();

router.get(`/search`, getUsersBySearchParams);


