import { NextFunction, Request, Response } from 'express';
import { getUsersByParams } from './user.service';
import { searchQuery } from '@groceries/shared_types';
import { InvalidData } from '../../middleware/Error.types';

export const getUsersBySearchParams = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = searchQuery.safeParse(req.query);
    if (parsedQuery.error) throw new InvalidData('Invalid data provided');
    const response = await getUsersByParams(parsedQuery.data);
    res.send(response);
  } catch (error) {
    next(error);
  }
};
