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

export const handleRestfulError = (
  error: Error,
  _request: Request,
  response: Response,
  _next: NextFunction
) => {
  const { status_code, message } = errorHandler(error);
  return response.status(status_code).json({ error: message });
};
export const handleSocketError = (error: Error): { success: false; error: string } => {
  const { message } = errorHandler(error);
  return { success: false, error: message };
};

const errorHandler = (error: Error) => {
  if (error instanceof CastError) {
    console.error('Invalid ID format:', error);
    return { status_code: error.statusCode || 400, message: 'Invalid ID format' };
  } else if (error instanceof ValidationError) {
    console.error('Invalid VALIDARTION ERROR data provided:', error.zodError.issues);
    return { status_code: error.statusCode || 400, message: 'Invalid data provided' };
  } else if (error instanceof ZodError) {
    return { status_code: 400, message: 'Invalid data provided' };
  } else if (error instanceof JsonWebTokenError) {
    console.error('Invalid token provided:', error);
    return { status_code: error.statusCode || 400, message: 'Invalid token provided' };
  } else if (error instanceof AuthenticationError) {
    console.error('Invalid username or password:', error);
    return { status_code: error.statusCode || 401, message: 'Invalid username or password' };
  } else if (error instanceof DatabaseError) {
    const dbError = parseMessageFromErrorCode(error.databaseError);
    console.log(dbError);
    return { status_code: error.statusCode || 500, message: dbError || 'Database error' };
  } else if (error instanceof ResourceNotFoundError) {
    console.error('Unexpected error:', error);
    return { status_code: error.statusCode || 404, message: error.message };
  } else if (error instanceof TokenExpiredError) {
    console.error('Token expired:', error);
    return {
      status_code: error.statusCode || 401,
      message: `Token has expired at ${error.token_error.expiredAt}`,
    };
  } else if (error instanceof AuthorizationError) {
    console.error('Authentication error:', error);
    return { status_code: error.statusCode || 403, message: error.message };
  } else if (error instanceof ApplicationError) {
    console.error('Application error:', error);
    return { status_code: error.statusCode || 500, message: error.message };
  } else {
    console.error('Unexpected error:', error.message, error.stack);
    return { status_code: 500, message: 'Internal server error' };
  }
};

export const parseMessageFromErrorCode = (error: dbError): string | undefined => {
  switch (error.code) {
    //unique violation
    case '23505':
      return parseUniqueViolation(error);

    // foreign key violation
    case '23503':
      return parseForeignKeyViolation(error);

    // not null violation
    case '23502':
      return parseNotNullViolation(error);
    case '08000':
    case '08003':
    case '08006':
      return 'Database temporarily unavailable';
    default:
      return 'Error in communicating with database';
  }
};

const parseUniqueViolation = (error: dbError) => {
  const constraint = error.constraint || '';
  if (constraint.includes('user')) {
    return 'Username already taken!';
  }
  if (constraint.includes('email')) {
    return 'Email already taken!';
  }
  return 'This value already exists!';
};

const parseForeignKeyViolation = (error: dbError) => {
  const constraint = error.constraint || '';

  if (constraint.includes('user')) {
    return 'User not found';
  }
  if (constraint.includes('task')) {
    return 'Task not found';
  }
  if (constraint.includes('relation')) {
    return 'List not found';
  }

  return 'Referenced item does not exist';
};
function parseNotNullViolation(error: dbError) {
  const column = error.column || 'field';

  return `${column} is required`;
}

export default errorHandler;
