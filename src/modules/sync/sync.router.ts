import express from 'express';
import { syncBatch } from './sync.controller';

export const router = express.Router();

router.post('/batch', syncBatch);
