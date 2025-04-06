import { ZodError } from 'zod';
import { DatabaseError as dbError } from 'pg';
import { TokenExpiredError as JWTTokenExpired } from 'jsonwebtoken';

export class ApplicationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthenticationError extends ApplicationError {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
  }
}
export class AuthorizationError extends ApplicationError {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = 403;
  }
}
export class ResourceNotFoundError extends ApplicationError {
  constructor(message: string) {
    super(message);
    this.name = 'ResourceNotFoundError';
    this.statusCode = 404;
  }
}
export class ValidationError extends ApplicationError {
  zodError: ZodError;
  constructor(message: string, error: ZodError) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.zodError = error;
  }
}
export class DatabaseError extends ApplicationError {
  databaseError: dbError;
  constructor(message: string, error: dbError) {
    super(message);
    this.name = 'DatabaseError';
    this.statusCode = 500;
    this.databaseError = error;
  }
}
export class TokenExpiredError extends ApplicationError {
  token_error: JWTTokenExpired;
  constructor(message: string, date: Date) {
    super(message);
    this.name = 'TokenExpiredError';
    this.statusCode = 401;
    this.token_error = new JWTTokenExpired(this.name, date);
  }
}
export class JsonWebTokenError extends ApplicationError {
  constructor(message: string) {
    super(message);
    this.name = 'JsonWebTokenError';
    this.statusCode = 401;
  }
}
export class CastError extends ApplicationError {
  constructor(message: string) {
    super(message);
    this.name = 'CastError';
    this.statusCode = 400;
  }
}