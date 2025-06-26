import { ZodError } from 'zod';
import { DatabaseError as dbError } from 'pg';
import { TokenExpiredError as JWTTokenExpired } from 'jsonwebtoken';

export class ApplicationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 500, name: string = 'ApplicationError') {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthenticationError extends ApplicationError {
  constructor(message: string) {
    super(message, 401, 'AuthenticationError');
  }
}
export class AuthorizationError extends ApplicationError {
  constructor(message: string) {
    super(message, 401,'AuthorizationError');
  }
}
export class ResourceNotFoundError extends ApplicationError {
  constructor(message: string) {
    super(message, 404, 'ResourceNotFoundError');
  }
}
export class ValidationError extends ApplicationError {
  zodError: ZodError;
  constructor(message: string, error: ZodError) {
    super(message, 400, 'ValidationError');
    this.zodError = error;
  }
}
export class DatabaseError extends ApplicationError {
  databaseError: dbError;
  constructor(message: string, error: dbError) {
    super(message, 500, 'DatabaseError');
    this.databaseError = error;
  }
}
export class TokenExpiredError extends ApplicationError {
  token_error: JWTTokenExpired;
  constructor(message: string, date: Date) {
    super(message, 401, 'TokenExpiredError');
    this.token_error = new JWTTokenExpired(this.name, date);
  }
}
export class JsonWebTokenError extends ApplicationError {
  constructor(message: string) {
    super(message, 401, 'JsonWebTokenError');
  }
}
export class CastError extends ApplicationError {
  constructor(message: string) {
    super(message, 400, 'CastError');
  }
}
