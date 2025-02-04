import { NextFunction, Request, Response } from 'express';
import { DatabaseError } from 'pg';
import { ZodError } from 'zod';
const ErrorHandler = (
  error: Error,
  request: Request,
  response: Response,
  next: NextFunction
) => {
  if (error.name === 'CastError') {
    console.error('Invalid ID format:', error);
    return response.status(400).json({ error: 'Invalid ID format' });
  } else if (error.name === 'ValidationError' || error.name === 'ZodError') {
    const zodError = error as ZodError;
    console.error('Invalid data provided:', zodError.issues);
    return response.status(400).json({ error: 'Invalid data provided' });
  } else if (error.name === 'JsonWebTokenError') {
    console.error('Invalid token provided:', error);
    return response.status(400).json({ error: 'Invalid token provided' });
  } else if (error.name === 'AuthenticationError') {
    console.error('Invalid username or password:', error);
    return response.status(401).json({ error: 'Invalid username or password' });
  } else if (error instanceof DatabaseError) {
    const dbError = parseMessageFromErrorCode(error);
    console.log(dbError);
    return response.status(400).json({ error: dbError });
  } else if (error.name === 'ResourceNotFoundError') {
    console.error('Unexpected error:', error);
    return response.status(404).json({ error: error.message });
  } else if (error.name === 'TokenExpiredError') {
    console.error('Token expired: ', error);
    return response.status(404).json({ error: error.message });
  } else {
    console.error('Unexpected error:', error.name);
    return response.status(500).json({ error: 'Internal server error' });
  }
};

const parseMessageFromErrorCode = (
  error: DatabaseError
): string | undefined => {
  switch (error.code) {
    case '23505':
      return error.detail;
    default:
      return 'Error in communicating with database';
  }
};
export default ErrorHandler;
