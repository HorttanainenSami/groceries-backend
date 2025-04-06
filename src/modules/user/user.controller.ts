import { NextFunction, Request, Response } from 'express';
import { getUsersByParams } from './user.service';
import { searchSchema } from './user.schema';

export const getUsersBySearchParams = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log('trying to search');
    const parsedQuery = searchSchema.safeParse(req.query);
    console.log(req.query);
    if (parsedQuery.error) return res.send(200);
    const response = await getUsersByParams(parsedQuery.data)
    res.send(response);
  } catch (error) {
    console.log(error);
    next(error);
  }
};

