import { Response, Request, NextFunction } from 'express';
import {
  CastError,
  ValidationError,
  AuthenticationError,
  ResourceNotFoundError,
  TokenExpiredError,
  JsonWebTokenError,
  DatabaseError,
  AuthorizationError,
  ApplicationError,
} from './Error.types';
import { DatabaseError as dbError } from 'pg';
import { ZodError } from 'zod';

const ErrorHandler = (
  error: Error,
  _request: Request,
  response: Response,
  _next: NextFunction
) => {
  
  if (error instanceof CastError) {
    console.error('Invalid ID format:', error);
    return response
      .status(error.statusCode || 400)
      .json({ error: 'Invalid ID format' });
  } else if (error instanceof ValidationError) {
    console.error(
      'Invalid VALIDARTION ERROR data provided:',
      error.zodError.issues
    );
    return response
      .status(error.statusCode || 400)
      .json({ error: 'Invalid data provided' });
  } else if (error instanceof ZodError) {
    return response.status(400).json({ error: 'Invalid data provided' });
  } else if (error instanceof JsonWebTokenError) {
    console.error('Invalid token provided:', error);
    return response
      .status(error.statusCode || 400)
      .json({ error: 'Invalid token provided' });
  } else if (error instanceof AuthenticationError) {
    console.error('Invalid username or password:', error);
    return response
      .status(error.statusCode || 401)
      .json({ error: 'Invalid username or password' });
  } else if (error instanceof DatabaseError) {
    const dbError = parseMessageFromErrorCode(error.databaseError);
    console.log(dbError);
    return response.status(error.statusCode || 400).json({ error: dbError });
  } else if (error instanceof ResourceNotFoundError) {
    console.error('Unexpected error:', error);
    return response
      .status(error.statusCode || 404)
      .json({ error: error.message });
  } else if (error instanceof TokenExpiredError) {
    console.error('Token expired:', error);
    return response
      .status(error.statusCode || 401)
      .json({ error: `Token has expired at ${error.token_error.expiredAt}` });
  } else if (error instanceof AuthorizationError) {
    console.error('Authentication error:', error);
    return response
      .status(error.statusCode || 403)
      .json({ error: error.message });
  } else if (error instanceof ApplicationError) {
    console.error('Application error:', error);
    return response
      .status(error.statusCode || 500)
      .json({ error: error.message });
  } else {
    console.error('Unexpected error:', error.message, error.stack);
    return response.status(500).json({ error: 'Internal server error' });
  }
};

const parseMessageFromErrorCode = (error: dbError): string | undefined => {
  switch (error.code) {
    case '23505':
      return error.detail;
    default:
      return 'Error in communicating with database';
  }
};

export default ErrorHandler;
